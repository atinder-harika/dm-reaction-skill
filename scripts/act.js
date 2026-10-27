// Reel Reactor: act step. Run with the Playwright MCP tool browser_run_code(_unsafe) { filename: <this file> }.
// Clicks the reactions and sends the one reply chosen by the skill, then verifies each against Instagram's
// own thread data: the reaction must be on that exact message, and no other message may have changed.
//
// Input: localStorage["reelReactor.act"] on instagram.com, set by the skill just before this runs:
//   { actions: [{ threadFbid, messageId, code, previewFile, emoji }],
//     reply: { threadFbid, messageId, code, previewFile, text } | null,
//     gapMs: [2000, 5000], probe: false }
// probe: true finds every bubble, scoped button and emoji but clicks/sends nothing (used by dry runs).
// Output: { ok, results: [{ code, action, status, detail? }] }
//   status: verified | unverified | wrong_message | not_found | skipped | probe_ok
async (page) => {
  const IG = 'https://www.instagram.com';
  if (!page.url().startsWith(IG)) await page.goto(IG + '/direct/inbox/', { waitUntil: 'domcontentloaded' });
  const input = await page.evaluate(() => JSON.parse(localStorage.getItem('reelReactor.act') || 'null'));
  if (!input) return { ok: false, error: 'missing_input: set localStorage["reelReactor.act"] first' };
  const actions = input.actions || [];
  const reply = input.reply || null;
  const probe = !!input.probe;
  const [gapMin, gapMax] = probe ? [0, 0] : input.gapMs || [2000, 5000];

  // Emojis missing from the quick bar are found through the picker search. These terms are tested.
  const SEARCH = { '💀': ['death', 'skull'], '🔥': ['flame', 'fire'], '😭': ['crying', 'loudly crying'], '😍': ['heart eyes'],
    '👏': ['clap'], '😮': ['open mouth'], '😂': ['joy', 'tears of joy'], '❤️': ['red heart'], '🤣': ['rolling'], '😆': ['laughing'], '🙌': ['raising hands'], '🫶': ['heart hands'] };
  const norm = (s) => String(s || '').replace(/️/g, '').trim();
  const isDetail = (r) => (r.postData() || '').includes('IGDThreadDetailQuery');
  const gap = () => page.waitForTimeout(gapMin + Math.random() * (gapMax - gapMin));
  const results = [];

  // Replays the thread query the page itself made, so verification reads Instagram's data, not the DOM.
  const makeFetcher = async (req) => {
    const tpl = { url: req.url(), body: req.postData(), headers: await req.allHeaders() };
    return () => page.evaluate(async (tpl) => {
      const h = {};
      for (const [k, v] of Object.entries(tpl.headers)) if (/^x-|^content-type$/i.test(k)) h[k] = v;
      const p = new URLSearchParams(tpl.body);
      const v = JSON.parse(p.get('variables'));
      for (const k of Object.keys(v)) if (/InitialMessagePageCount/.test(k)) v[k] = 60;
      v.min_uq_seq_id = null;
      p.set('variables', JSON.stringify(v));
      const r = await fetch(tpl.url, { method: 'POST', body: p.toString(), headers: h, credentials: 'include' });
      const t = (await r.json())?.data?.get_slide_thread_nullable?.as_ig_direct_thread;
      if (!t) return null;
      const me = t.viewer?.interop_messaging_user_fbid;
      return { me, messages: (t.slide_messages?.edges || []).map(({ node: m }) => ({ id: m.message_id || m.id, sender: m.sender_fbid, text: m.text_body || '',
        repliedTo: m.replied_to_message_id || null, mine: (m.reactions || []).filter((x) => x.sender_fbid === me).map((x) => x.reaction).join('') })) };
    }, tpl);
  };

  // Scrolls the message list itself (not whatever is under the mouse) by ~one screen. Returns false at the end.
  const scrollList = (dir) => page.evaluate((dir) => {
    let el = document.querySelector('[role=article]')?.parentElement;
    while (el && !(el.scrollHeight > el.clientHeight + 10 && /auto|scroll/.test(getComputedStyle(el).overflowY))) el = el.parentElement;
    if (!el) return false;
    const before = el.scrollTop;
    el.scrollTop += dir * el.clientHeight * 0.8;
    return Math.abs(el.scrollTop - before) > 1;
  }, dir);

  // Finds the message row for one reel: the article whose preview image matches. The list is virtualized
  // (only a few messages are rendered), so search up to the oldest message, then back down to the newest.
  const findArticle = async (previewFile) => {
    const article = page.locator('[role=article]').filter({ has: page.locator(`img[src*="${previewFile}"]`) }).first();
    for (const dir of [-1, 1]) {
      for (let i = 0; i < 25; i++) {
        if (await article.count()) { await article.scrollIntoViewIfNeeded(); return article; }
        if (!(await scrollList(dir))) {
          // At the end of the list: give lazy-loaded older messages a moment to arrive, then try once more.
          await article.waitFor({ state: 'attached', timeout: 1500 }).catch(() => {});
          if (await article.count()) { await article.scrollIntoViewIfNeeded(); return article; }
          if (!(await scrollList(dir))) break;
        }
        await article.waitFor({ state: 'attached', timeout: 600 }).catch(() => {});
      }
    }
    return null;
  };

  // The action buttons for *this* message: the nearest ancestor of the article that holds the button,
  // and it must contain exactly one article (so it can't be a neighbouring message's toolbar).
  const scopedButton = async (article, labelStart) => {
    await article.hover();
    const row = article.locator(`xpath=ancestor::div[.//div[@role="button" and starts-with(@aria-label, "${labelStart}")]][1]`);
    await row.waitFor({ timeout: 4000 });
    if ((await row.locator('[role=article]').count()) !== 1) throw new Error('ambiguous_row');
    const btn = row.locator(`[role=button][aria-label^="${labelStart}"]`).first();
    await btn.waitFor({ state: 'visible', timeout: 3000 });
    return btn;
  };

  // In probe mode the emoji is located but not clicked, and the picker is closed again.
  const clickEmojiIn = async (dialog, emoji) => {
    const buttons = dialog.locator('[role=button]');
    const idx = await buttons.evaluateAll((els, e) => els.findIndex((b) => (b.innerText || '').replace(/️/g, '').trim() === e), norm(emoji));
    if (idx < 0) return false;
    if (probe) { await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); }
    else await buttons.nth(idx).click();
    return true;
  };

  const react = async (article, emoji) => {
    await (await scopedButton(article, 'React to message')).click();
    const dialog = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Choose an emoji' }) }).last();
    await dialog.waitFor({ timeout: 4000 });
    if (await clickEmojiIn(dialog, emoji)) return;
    await dialog.getByRole('button', { name: 'Choose an emoji' }).click();
    const search = page.locator('input[aria-label="Search emoji"]').last();
    await search.waitFor({ timeout: 4000 });
    const picker = page.getByRole('dialog').filter({ has: search }).last();
    for (const term of SEARCH[emoji] || SEARCH[norm(emoji)] || []) {
      await search.fill(term);
      await picker.locator('[role=button]').filter({ hasText: norm(emoji) }).first().waitFor({ timeout: 1500 }).catch(() => {});
      if (await clickEmojiIn(picker, emoji)) return;
    }
    await page.keyboard.press('Escape');
    throw new Error('emoji_not_in_picker');
  };

  const waitFor = async (fetchThread, check, tries = 5) => {
    for (let i = 0; i < tries; i++) {
      const data = await fetchThread();
      if (data && check(data)) return data;
      await page.waitForTimeout(800);
    }
    return null;
  };

  // Group work per thread so each thread is opened once.
  const byThread = new Map();
  for (const a of actions) (byThread.get(a.threadFbid) || byThread.set(a.threadFbid, { reacts: [], reply: null }).get(a.threadFbid)).reacts.push(a);
  if (reply) (byThread.get(reply.threadFbid) || byThread.set(reply.threadFbid, { reacts: [], reply: null }).get(reply.threadFbid)).reply = reply;

  for (const [threadFbid, work] of byThread) {
    const reqP = page.waitForRequest(isDetail, { timeout: 20000 }).catch(() => null);
    await page.goto(`${IG}/direct/t/${threadFbid}/`, { waitUntil: 'domcontentloaded' });
    if (/accounts\/login|challenge|checkpoint/.test(page.url())) return { ok: false, error: 'login_required', results };
    const req = await reqP;
    await page.locator('[role=article]').first().waitFor({ timeout: 15000 }).catch(() => {});
    // The message list re-renders once right after load; let it settle so located bubbles stay attached.
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    const fetchThread = req ? await makeFetcher(req) : null;
    if (!fetchThread) { for (const a of work.reacts) results.push({ code: a.code, action: a.emoji, status: 'skipped', detail: 'no_thread_data' }); continue; }

    for (const a of work.reacts) {
      const before = await fetchThread();
      const beforeMine = Object.fromEntries((before?.messages || []).map((m) => [m.id, m.mine]));
      if (beforeMine[a.messageId]) { results.push({ code: a.code, action: a.emoji, status: 'skipped', detail: 'already_reacted' }); continue; }
      try {
        let article = null;
        // A re-render can detach the bubble mid-action. Retry, but only while no reaction of ours has landed anywhere.
        for (let attempt = 0; ; attempt++) {
          try {
            article = a.previewFile ? await findArticle(a.previewFile) : null;
            if (article) await react(article, a.emoji);
            break;
          } catch (e) {
            await page.keyboard.press('Escape').catch(() => {});
            if (attempt >= 2 || !/not attached|detached/i.test(String(e.message))) throw e;
            const now = await fetchThread();
            if ((now?.messages || []).some((m) => m.mine !== (beforeMine[m.id] || ''))) break;
          }
        }
        if (!article) { results.push({ code: a.code, action: a.emoji, status: 'not_found' }); continue; }
        if (probe) { results.push({ code: a.code, action: a.emoji, status: 'probe_ok' }); continue; }
        const after = await waitFor(fetchThread, (d) => d.messages.some((m) => m.id === a.messageId && m.mine) || d.messages.some((m) => m.mine !== (beforeMine[m.id] || '')));
        const target = after?.messages.find((m) => m.id === a.messageId);
        const others = (after?.messages || []).filter((m) => m.id !== a.messageId && m.mine !== (beforeMine[m.id] || '')).map((m) => m.id);
        if (others.length) results.push({ code: a.code, action: a.emoji, status: 'wrong_message', detail: others.join(',') });
        else if (target?.mine && norm(target.mine) === norm(a.emoji)) results.push({ code: a.code, action: a.emoji, status: 'verified' });
        else results.push({ code: a.code, action: a.emoji, status: 'unverified', detail: target?.mine ? 'got ' + target.mine : 'no reaction seen' });
      } catch (e) {
        await page.keyboard.press('Escape').catch(() => {});
        results.push({ code: a.code, action: a.emoji, status: 'skipped', detail: String(e.message || e).split('\n')[0].slice(0, 120) });
      }
      await gap();
    }

    if (work.reply) {
      const r = work.reply;
      try {
        const article = r.previewFile ? await findArticle(r.previewFile) : null;
        if (!article) { results.push({ code: r.code, action: 'reply', status: 'not_found' }); continue; }
        const replyBtn = await scopedButton(article, 'Reply to message');
        if (probe) { results.push({ code: r.code, action: 'reply', status: 'probe_ok' }); continue; }
        await replyBtn.click();
        const box = page.locator('[role=textbox][contenteditable="true"]').last();
        await box.waitFor({ timeout: 4000 });
        await box.click();
        await page.keyboard.type(r.text, { delay: 25 + Math.random() * 40 });
        await page.keyboard.press('Enter');
        const after = await waitFor(fetchThread, (d) => d.messages.some((m) => m.sender === d.me && m.text.trim() === r.text.trim()), 6);
        const sent = after?.messages.find((m) => m.sender === after.me && m.text.trim() === r.text.trim());
        results.push({ code: r.code, action: 'reply', status: sent ? 'verified' : 'unverified', detail: sent ? (sent.repliedTo === r.messageId ? 'quoted the reel' : 'sent, not linked to the reel') : 'reply not seen in thread data' });
      } catch (e) {
        results.push({ code: r.code, action: 'reply', status: 'skipped', detail: String(e.message || e).split('\n')[0].slice(0, 120) });
      }
    }
  }
  await page.evaluate(() => localStorage.removeItem('reelReactor.act'));
  return { ok: true, results };
}
