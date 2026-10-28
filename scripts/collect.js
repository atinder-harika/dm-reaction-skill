// Reel Reactor: collect step. Run with the Playwright MCP tool browser_run_code(_unsafe) { filename: <this file> }.
// Read-only. Reads Instagram's own data feeds inside the logged-in page (the same GraphQL queries the
// DM page makes, replayed with the page's cookies) and returns every new, unreacted reel that whitelisted
// friends sent, with caption, play/like counts and top comments. Nothing is clicked, sent or marked read.
//
// Input: localStorage["reelReactor.input"] on instagram.com, set by the skill just before this runs:
//   { friends: [usernames], processedReelIds: [codes], recheckFriends: [usernames], lastSeen: { username: ms },
//     force: bool, maxReelsPerRun: 15, messagesPerThread: 60, topComments: 5 }
// A thread is checked when it has activity newer than lastSeen[friend] (the thread's last activity at our previous
// check), not when Instagram marks it unread, so opening a chat yourself doesn't hide its new reels.
// Output: { ok, earlyExit?, viewer, threads: [{ friend, check, lastActivity, unread, ... }], reels: [...], alreadyReacted: [codes], error? }
async (page) => {
  const IG = 'https://www.instagram.com';
  const isQuery = (name) => (r) => ((typeof r.request === 'function' ? r.request() : r).postData() || '').includes(name);

  if (!page.url().startsWith(IG)) await page.goto(IG + '/direct/inbox/', { waitUntil: 'domcontentloaded' });
  if (/accounts\/login|challenge|checkpoint/.test(page.url())) return { ok: false, error: 'login_required', url: page.url() };
  const input = await page.evaluate(() => JSON.parse(localStorage.getItem('reelReactor.input') || 'null'));
  if (!input || !Array.isArray(input.friends)) return { ok: false, error: 'missing_input: set localStorage["reelReactor.input"] first' };
  const opts = { maxReelsPerRun: 15, messagesPerThread: 60, topComments: 5, recheckFriends: [], processedReelIds: [], lastSeen: {}, force: false, ...input };
  const lastSeen = Object.fromEntries(Object.entries(opts.lastSeen || {}).map(([k, v]) => [k.toLowerCase(), String(v)]));
  const friends = new Set(opts.friends.map((f) => f.toLowerCase().replace(/^@/, '')));
  const recheck = new Set(opts.recheckFriends.map((f) => f.toLowerCase()));
  const processed = new Set(opts.processedReelIds);

  // Load the inbox and keep the first thread-detail request the page makes as a template to replay.
  let detailReq = null;
  const onReq = (req) => { if (!detailReq && isQuery('IGDThreadDetailQuery')(req)) detailReq = req; };
  page.on('request', onReq);
  const inboxRes = page.waitForResponse(isQuery('PolarisDirectInboxQuery'), { timeout: 30000 });
  await page.goto(IG + '/direct/inbox/', { waitUntil: 'domcontentloaded' });
  if (/accounts\/login|challenge|checkpoint/.test(page.url())) { page.off('request', onReq); return { ok: false, error: 'login_required', url: page.url() }; }
  let inbox;
  try { inbox = await (await inboxRes).json(); } catch (e) { page.off('request', onReq); return { ok: false, error: 'inbox_query_not_seen: ' + e.message }; }

  const mailbox = inbox?.data?.get_slide_mailbox_for_iris_subscription;
  const viewerFbid = mailbox?.id;
  const allThreads = (mailbox?.threads_by_folder?.edges || []).map((e) => e.node?.as_ig_direct_thread).filter(Boolean);
  const threads = [];
  for (const username of friends) {
    const t = allThreads.find((x) => !x.is_group && x.users?.length === 1 && x.users[0].username?.toLowerCase() === username);
    if (!t) { threads.push({ friend: username, status: 'not_in_recent_inbox' }); continue; }
    const seen = (t.slide_read_receipts || []).find((r) => r.participant_fbid === viewerFbid)?.watermark_timestamp_ms || '0';
    const lastActivity = String(t.last_activity_timestamp_ms || '0');
    const unread = !!t.marked_as_unread || BigInt(lastActivity) > BigInt(seen);
    // Never checked, or anything happened since our last check (read or not) → look at the thread.
    const changed = !(username in lastSeen) || BigInt(lastActivity) > BigInt(lastSeen[username] || '0');
    threads.push({ friend: username, threadFbid: t.thread_fbid, threadKey: t.thread_key, friendFbid: t.users[0].interop_messaging_user_fbid,
      lastActivity, unread, check: changed || unread || opts.force || recheck.has(username) });
  }
  const toCheck = threads.filter((t) => t.check);
  const viewer = { fbid: viewerFbid };
  const publicThreads = () => threads.map(({ threadKey, friendFbid, ...t }) => t);
  if (!toCheck.length) { page.off('request', onReq); return { ok: true, earlyExit: true, viewer, threads: publicThreads(), reels: [], alreadyReacted: [] }; }

  // The inbox page usually prefetches the top thread; if it hasn't, wait for it (element-based, no fixed sleeps).
  if (!detailReq) await page.waitForRequest(isQuery('IGDThreadDetailQuery'), { timeout: 8000 }).catch(() => {});
  page.off('request', onReq);
  if (!detailReq) return { ok: false, error: 'thread_query_template_not_seen', viewer, threads: publicThreads() };
  const tpl = { url: detailReq.url(), body: detailReq.postData(), headers: await detailReq.allHeaders() };

  // Runs in the page: replay the thread query per friend, then fetch reel info and comments.
  const result = await page.evaluate(async ({ tpl, toCheck, viewerFbid, processed, opts }) => {
    const headers = {};
    for (const [k, v] of Object.entries(tpl.headers)) if (/^x-|^content-type$/i.test(k)) headers[k] = v;
    const restHeaders = { 'X-IG-App-ID': headers['x-ig-app-id'] || '936619743392459', 'X-Requested-With': 'XMLHttpRequest', 'X-CSRFToken': headers['x-csrftoken'] };
    const getJson = async (url) => { const r = await fetch(url, { headers: restHeaders, credentials: 'include' }); return r.ok ? r.json() : null; };
    const fileOf = (u) => (String(u || '').match(/\/([^/?]+)\.(?:jpg|jpeg|webp|heic|png)/) || [])[1] || null;

    const reels = [], alreadyReacted = [], threadNotes = {};
    for (const t of toCheck) {
      const p = new URLSearchParams(tpl.body);
      const v = JSON.parse(p.get('variables'));
      v.thread_fbid = t.threadKey;
      v.min_uq_seq_id = null;
      for (const k of Object.keys(v)) if (/InitialMessagePageCount/.test(k)) v[k] = opts.messagesPerThread;
      p.set('variables', JSON.stringify(v));
      let thread;
      try {
        const r = await fetch(tpl.url, { method: 'POST', body: p.toString(), headers, credentials: 'include' });
        thread = (await r.json())?.data?.get_slide_thread_nullable?.as_ig_direct_thread;
      } catch (e) { threadNotes[t.friend] = 'thread_fetch_failed'; continue; }
      if (!thread) { threadNotes[t.friend] = 'thread_fetch_empty'; continue; }
      const edges = thread.slide_messages?.edges || [];
      threadNotes[t.friend] = edges.length + ' messages' + (thread.slide_messages?.page_info?.has_previous_page ? ' (older exist)' : '');
      for (const { node: m } of edges) {
        if (!m || m.sender_fbid !== t.friendFbid) continue;
        const xma = m.content?.xma;
        const url = xma?.target_url || '';
        const mm = url.match(/instagram\.com\/(reels?|p)\/([\w-]+)/);
        if (!mm) continue;
        const code = mm[2];
        if (processed.includes(code)) continue;
        if ((m.reactions || []).some((r) => r.sender_fbid === viewerFbid)) { alreadyReacted.push(code); continue; }
        const mediaPk = (url.match(/[?&]id=(\d+)/) || [])[1] || xma?.target_id || null;
        reels.push({ friend: t.friend, threadFbid: t.threadFbid, messageId: m.message_id || m.id, code, url: `https://www.instagram.com/reel/${code}/`,
          mediaPk, sentAt: new Date(Number(m.timestamp_ms)).toISOString(), previewFile: fileOf(xma?.preview_image?.url), owner: xma?.header_title_text || null });
      }
    }
    // Newest first, capped.
    reels.sort((a, b) => b.sentAt.localeCompare(a.sentAt));
    const capped = reels.slice(0, opts.maxReelsPerRun);

    for (const reel of capped) {
      if (!reel.mediaPk) { reel.meta = 'no_media_id'; continue; }
      const info = await getJson(`/api/v1/media/${reel.mediaPk}/info/`);
      const m = info?.items?.[0];
      if (m) Object.assign(reel, { caption: (m.caption?.text || '').slice(0, 200), plays: m.play_count ?? m.ig_play_count ?? m.view_count ?? null,
        likes: m.like_count ?? null, commentCount: m.comment_count ?? null, owner: m.user?.username || reel.owner });
      const c = await getJson(`/api/v1/media/${reel.mediaPk}/comments/?can_support_threading=true&permalink_enabled=false`);
      reel.topComments = (c?.comments || []).filter((x) => (x.text || '').trim()).sort((a, b) => (b.comment_like_count || 0) - (a.comment_like_count || 0))
        .slice(0, opts.topComments).map((x) => ({ text: (x.text || '').slice(0, 150), likes: x.comment_like_count || 0 }));
      delete reel.mediaPk;
    }
    return { reels: capped, overCap: reels.length - capped.length, alreadyReacted, threadNotes };
  }, { tpl, toCheck, viewerFbid, processed: [...processed], opts });

  for (const t of threads) if (result.threadNotes[t.friend]) t.note = result.threadNotes[t.friend];
  return { ok: true, viewer, threads: publicThreads(), reels: result.reels, overCap: result.overCap, alreadyReacted: result.alreadyReacted };
}
