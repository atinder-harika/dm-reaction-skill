---
name: react
description: Run Reel Reactor once. Reads Instagram DMs from whitelisted friends through the Playwright MCP, reacts to new reels with a mood-matched emoji, and sends the friend one short funny reply about the standout reel. Use when the user says "run reel reactor", "react to my reels", "watch mode", or a scheduled job invokes it.
---

# Reel Reactor: one run

You are driving a real Instagram account through the Playwright MCP browser tools. Use the plugin's
bundled server (`mcp__plugin_reel-reactor_playwright__*`), or `mcp__playwright__*` if that's the one
loaded. If neither exists, stop and tell the user to run `/reel-reactor:setup`.

There are two modes:
- **Fast mode** (default, used by scheduled runs): two scripts do the browser work in single calls and
  you only do the judgment (mood, emoji, reply text). It takes about 6 tool calls.
- **Watch mode** (`config.mode` = `"watch"`, or the user says "watch mode"): the same run done step by
  step with visible clicks, for demos and screen recordings. Fast mode also falls back to it if the
  collect script fails.

## Files

User files live in `~/.reel-reactor/` (on Windows: `%USERPROFILE%\.reel-reactor\`):
- `config.json`: the user's config (schema in `config/reel-reactor.example.json` at the plugin root)
- `state.json`: `{ "lastRun": ISO, "processedReelIds": [codes], "recheckFriends": [usernames] }`

If `config.json` is missing, stop and tell the user to run `/reel-reactor:setup`. If `state.json`
is missing, start from `{ "lastRun": null, "processedReelIds": [], "recheckFriends": [] }`.

The scripts are in `scripts/` at the plugin root, two levels up from this skill's base directory.
Pass their **absolute** path as `filename`.

## Guardrails (never break these)

- Only touch DM threads with usernames in `config.friends`.
- Never type a username or password. If Instagram shows a login page, a checkpoint, a "suspicious
  activity" screen or a CAPTCHA (`error: "login_required"` from a script), stop, change nothing and
  tell the user.
- The only writes allowed are emoji reactions on reel messages from whitelisted friends, plus at most
  `config.repliesPerRun` (default 1, max 1) reply in that friend's thread. No other DMs, no comments on
  reels, no follows or likes, no settings.
- Never pick a React or Reply button by its position on the page. It must belong to the message that
  contains that reel (the act script enforces this; in watch mode you do).
- Every reaction must be **verified** on the right reel afterwards. If one landed on the wrong message,
  stop the run and tell the user which message it was, so they can fix it by hand.
- Reply text: 15 words max, casual lowercase, 0 to 1 emoji, no @mentions, hashtags or links, nothing
  mean, sexual, political or about anyone's looks. Riff on the reel and its top comments; don't copy one.
- `config.dryRun` = true means reading and probing only: nothing is clicked or sent.

## Fast mode

### 1. Load config and state
Read both files. Defaults: `maxReelsPerRun` 15, `repliesPerRun` 1 (an old `commentsPerRun` key means the same).

### 2. Collect (one call, read-only)
1. `browser_navigate` to `https://www.instagram.com/direct/inbox/` (the scripts read their input from
   this site's localStorage).
2. `browser_evaluate` with
   `() => { localStorage.setItem('reelReactor.input', JSON.stringify(<INPUT>)); }`, where INPUT is
   `{ friends, processedReelIds, recheckFriends, force, maxReelsPerRun }` from config and state.
   `force` is true only when the user asked for a full re-check; scheduled runs use false.
3. `browser_run_code` (or `browser_run_code_unsafe`) with `filename` = `<plugin root>/scripts/collect.js`.

It returns `{ ok, earlyExit, threads, reels, alreadyReacted }`:
- `earlyExit: true` means no whitelisted thread is unread. Update `lastRun`, print
  "Nothing new from <friends>", and **stop**. Most scheduled runs end here in seconds.
- `ok: false` with `login_required`: stop (guardrail). With any other error, tell the user the data feed
  didn't work and continue in **watch mode** from its step 2.
- Each reel has `friend, threadFbid, messageId, code, previewFile, owner, caption, plays, likes,
  commentCount, topComments[]`. Codes in `alreadyReacted` count as processed.

If `reels` is empty, go to step 6.

### 3. Judge each reel
Classify the mood from the top comments (and the caption when there are few):
`funny`, `wholesome`, `shocking`, `hype`, `sad`, `cringe`, `love`. Then pick an emoji from
`config.emojiPalette`:
funny → 😂 or 💀 · wholesome → 😍 or ❤️ · shocking → 😮 · hype → 🔥 or 👏 · sad → 😭 · cringe → 💀 · love → ❤️.
No comments at all → `config.defaultEmoji`.

Roll the dice for all reels in **one** command with a real RNG (don't make the numbers up):
`node -e "console.log(JSON.stringify(Array.from({length:N},()=>Math.floor(Math.random()*100))))"`
Map each roll with `config.ratios`: below `emoji*100` → emoji; the next `sticker*100` → sticker,
which counts as emoji while `stickersEnabled` is false; otherwise → none (left alone, which looks human).

**The reply:** pick the standout reel (most `plays`, falling back to `likes`, then `commentCount`), and
write one reply **to the friend** about it, following the guardrail rules. It should sound like a
friend reacting to what they sent, e.g. "the prius recycling dinosaurs comment is sending me".
Skip the reply when `repliesPerRun` is 0.

### 4. Act (one call)
1. `browser_evaluate` with `() => { localStorage.setItem('reelReactor.act', JSON.stringify(<ACT>)); }`:
   ```json
   { "probe": <config.dryRun>, "gapMs": [2000, 5000],
     "actions": [{ "threadFbid": "…", "messageId": "…", "code": "…", "previewFile": "…", "emoji": "😂" }],
     "reply": { "threadFbid": "…", "messageId": "…", "code": "…", "previewFile": "…", "text": "…" } }
   ```
   Include only reels whose roll gave an emoji. `reply` is null when skipped.
2. `browser_run_code` with `filename` = `<plugin root>/scripts/act.js`.

Each result has a `status`:
- `verified`: done, and confirmed in Instagram's data on the right message
- `probe_ok`: dry run, where everything was found but nothing was clicked
- `not_found` / `skipped` / `unverified`: not done (the detail says why); it gets retried next run
- `wrong_message`: a reaction landed on a different message. **Stop** and tell the user which one.

### 5. Retry once in watch mode (optional)
If 1 to 3 reactions came back `not_found` or `skipped`, you may redo just those with the watch-mode
step-by-step procedure (step 4 there). Leave `unverified` ones alone, so nothing gets doubled.

### 6. Save state and report
Write `state.json`:
- `lastRun`: now (ISO 8601)
- `processedReelIds`: the old ones, plus this run's codes that are `verified`, rolled `none`, or in
  `alreadyReacted`. Keep the newest 500. In dry-run mode, add nothing.
- `recheckFriends`: friends who still have reels that weren't done (`not_found`, `skipped`,
  `unverified`, over the cap), and in dry-run mode every friend that had reels. Opening a thread marks
  it read, so without this the early-exit check would never look at that thread again. Drop a friend
  from the list once a run leaves nothing unfinished for them.

There's no "older than the last run" cutoff. Every reel is judged only by `processedReelIds` and
whether it already has your reaction, so reels a run couldn't load are picked up by the next one.

Print the summary table and one line of totals:

| friend | reel | mood | action | result |
|---|---|---|---|---|
| sam | C9xYz… | funny | 😂 | verified |
| sam | C9aBc… | hype | none (roll 93) | — |
| alex | C8qRs… | wholesome | 😍 + reply: "the dog's face at the end lmao" | verified |

## Watch mode (step by step, for demos)

Same rules and the same judgment, but done with visible snapshot, hover and click steps. Narrate each
step in one short line so a screen recording reads well. Use `browser_wait_for` with text or an element
rather than fixed waits, except for the random 2 to 5 second gaps between reactions.

1. **Load** config and state (fast mode step 1).
2. **Find the reels.** If the collect script worked, use its list. Otherwise, for each friend, open
   their thread from the inbox and snapshot it. Shared reels are message bubbles with a reel preview
   image. Take the ones the friend sent that don't already show your reaction and aren't in
   `processedReelIds`. Scroll up (`PageUp`) only while every visible reel is still new.
3. **Read each reel.** `browser_navigate` to `https://www.instagram.com/reel/<code>/`, wait for the
   comments to appear, and read the caption, counts and top 4 or 5 comments. Judge it as in fast mode step 3.
4. **React, scoped to that message.** Back in the friend's thread:
   1. Find the bubble that contains *that* reel's preview image (its file name is `previewFile` when
      the collect script ran). Hover that bubble.
   2. Click the **React to message from <friend>** button that sits inside that same message row,
      never one picked by position or from a neighbouring row.
   3. Pick the emoji from the quick bar (❤️ 😂 😮 😢 😡 👍). Otherwise click **Choose an emoji** in the
      dialog and search: 💀 "death", 🔥 "flame", 😭 "crying", 😍 "heart eyes", 👏 "clap".
   4. **Required check:** snapshot and confirm the emoji now shows under that reel's bubble and under no
      other one. If it went to the wrong message, stop (guardrail).
5. **Reply** on the standout reel: hover it, click **Reply to message from <friend>** in that row, type
   the reply in the message box, press Enter, and confirm it shows in the thread.
6. **Save state and report** (fast mode step 6).
