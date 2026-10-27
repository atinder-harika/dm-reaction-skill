---
name: react
description: Run Reel Reactor once. Opens Instagram DMs from whitelisted friends through the Playwright MCP, reacts to new reels with a mood-matched emoji, and posts one short funny comment on the standout reel. Use when the user says "run reel reactor", "react to my reels", or a scheduled job invokes it.
---

# Reel Reactor: one run

You are driving a real Instagram account through the Playwright MCP browser tools
(`browser_navigate`, `browser_snapshot`, `browser_click`, `browser_hover`, `browser_type`,
`browser_press_key`, `browser_wait_for`). Use the plugin's bundled server
(`mcp__plugin_reel-reactor_playwright__*`), or `mcp__playwright__*` if that's the one loaded.
If neither exists, stop and tell the user to run `/reel-reactor:setup`.
Work from accessibility snapshots, not guesses.
Be careful and slow; a skipped reel is always better than a wrong click.

## Files

All user files live in `~/.reel-reactor/` (on Windows: `%USERPROFILE%\.reel-reactor\`):

- `config.json`: the user's config (schema in `config/reel-reactor.example.json` at the plugin root)
- `state.json`: written by this skill at the end of every run

If `config.json` is missing, stop and tell the user to run the `reel-reactor:setup` skill.
If `state.json` is missing, start with `{ "lastRun": null, "processedReelIds": [] }`.

## Guardrails (never break these)

- Only open DM threads with usernames in `config.friends`. Ignore every other thread.
- Never type a username or password. If Instagram shows a login page, a checkpoint,
  a "suspicious activity" screen or a CAPTCHA, stop the run, change nothing and tell the user.
- Never send a DM, follow, unfollow, like posts, or touch account settings.
  The only writes allowed are an emoji reaction on a DM message and one comment per run.
- If the UI doesn't match these instructions (a button is missing or a dialog is unfamiliar),
  skip that reel, record `skipped: <reason>` and carry on.
- When `config.dryRun` is true, do every read step but no reaction and no comment.
  Report what you *would* have done.

## Steps

### 1. Load config and state
Read both files. Note `config.maxReelsPerRun` (default 15) and `config.commentsPerRun` (default 1).

### 2. Open the inbox
`browser_navigate` to `https://www.instagram.com/direct/inbox/`, then `browser_snapshot`.
Dismiss "Turn on notifications" style popups with **Not Now**. Check that you're logged in.

### 3. Collect new reels per friend
For each username in `config.friends`:
1. Open their thread. Click it in the inbox list, or use the inbox search box and type the username.
2. Snapshot the thread. Shared reels show up as message bubbles that link to `/reel/<id>/`
   (sometimes `/p/<id>/`). The `<id>` shortcode is the reel's identity.
3. Keep only reels that are **sent by the friend** (left-hand bubbles, not yours) and whose id
   is **not** in `state.processedReelIds`. Scroll up with `browser_press_key` `PageUp` only
   while every visible reel is still new. Stop once you reach an already processed reel, or
   anything older than `state.lastRun` when the thread shows timestamps.
4. Record `{ friend, reelId, url }` for each. Stop collecting at `maxReelsPerRun` in total.

If nothing is new, skip to step 7.

### 4. Read each reel's vibe
For each collected reel:
1. `browser_navigate` to `https://www.instagram.com/reel/<id>/` and snapshot.
2. Read the caption, the like count and the view/play count if shown, plus the **top 4 or 5
   comments** (open the comments panel if needed; don't scroll endlessly).
3. Classify the mood from the comments (and caption if there are few comments):
   `funny`, `wholesome`, `shocking`, `hype`, `sad`, `cringe`, `love`.
4. Choose an emoji from `config.emojiPalette`, using this guide:
   funny → 😂 or 💀 · wholesome → 😍 or ❤️ · shocking → 😮 · hype → 🔥 or 👏 ·
   sad → 😭 · cringe → 💀 · love → ❤️. With **no comments at all**, use `config.defaultEmoji`.

### 5. Roll the dice for each reel
Use a real RNG and don't pick the numbers yourself. Run one command per reel:
`node -e "console.log(Math.floor(Math.random()*100))"`

Map the roll with `config.ratios`:
- roll < `emoji*100` → **emoji**
- next `sticker*100` → **sticker** when `stickersEnabled` is true; in v1 that's off, so treat it as **emoji**
- otherwise → **none** (leave it alone, which looks more human)

### 6. Act
**Emoji reaction (in the DM thread):**
1. Go back to the friend's thread (`https://www.instagram.com/direct/inbox/` then open it).
2. `browser_hover` the reel's message bubble. A small toolbar appears next to it with a
   **React** (smiley) button. Click it.
3. Pick the chosen emoji from the quick bar. If it isn't there, click the **+**, type the
   emoji's name in the search box (e.g. "joy", "skull", "fire"), and click the result.
4. Snapshot to confirm the reaction shows under the bubble. If the reel already had *your*
   reaction, leave it alone.
5. `browser_wait_for` a random 2 to 5 seconds before the next action.

**One comment on the standout reel** (`commentsPerRun` times, usually 1):
1. Among this run's reels, pick the standout: the highest view count, falling back to likes,
   then the most comments.
2. Write a comment that reacts to the reel *and* riffs on its top comments:
   - 15 words max, casual lowercase, 0 to 1 emoji
   - no @mentions, no hashtags, no links, nothing mean, sexual, political or about anyone's looks
   - don't copy any existing comment word for word
3. On `https://www.instagram.com/reel/<id>/`, click the **Add a comment…** box, `browser_type`
   the text, then click **Post**. Snapshot to confirm it appears.

### 7. Save state and report
Write `state.json`:
```json
{
  "lastRun": "<now, ISO 8601>",
  "processedReelIds": ["<old ids + this run's ids, keep only the newest 500>"]
}
```
In dry-run mode, **don't** update `processedReelIds` (so the real run sees the same reels),
but do update `lastRun`.

Then print a summary table:

| friend | reel | mood | action |
|---|---|---|---|
| sam | C9xYz… | funny | 😂 |
| sam | C9aBc… | hype | none (roll 93) |
| alex | C8qRs… | wholesome | 😍 + comment: "the dog's face at the end lmao" |

Finish with one line: reels seen, reactions made, comment posted (yes/no), skips and why.
