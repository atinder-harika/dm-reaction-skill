# 🎬 Reel Reactor

> Your friends send you 40 reels a day. Reel Reactor reacts to them for you.

A Claude Code plugin that opens your Instagram DMs a few times a day, finds the reels your
whitelisted friends sent you, reads the room (the top comments), and reacts with a fitting emoji.
Once per run it also sends the friend a short funny reply about the standout reel.

<!-- TODO: demo GIF -->

---

## ⚠️ Disclaimer

**This is an educational toy project, made for fun.**

- Automating Instagram **probably violates [Instagram's Terms of Use](https://help.instagram.com/581066165581870)**.
  Your account could be rate-limited, flagged or banned.
- **Use a throwaway account.** It's only been tested on one.
- Not affiliated with, endorsed by or connected to Meta or Instagram.
- You're responsible for how you use it. Only whitelist friends who are fine with a bot reacting to them.
- No warranty. Instagram's UI changes often and this can break at any time.

---

## How it works

```
Claude app Scheduled task (9am / 12pm / 5pm)
   └─▶ /reel-reactor:react  (a skill = plain-English instructions)
         └─▶ bundled Playwright browser, logged in as you
               1. collect.js  (1 call, read-only)
                  inbox data ─▶ any whitelisted thread unread?  no ─▶ done in seconds
                  thread data ─▶ new reels without your reaction
                  reel data   ─▶ caption, plays, likes, top comments
               2. Claude judges: mood ─▶ emoji (~80-90%) · leave some alone (~10%)
                                 standout reel ─▶ 1 short funny reply to the friend
               3. act.js  (1 call)
                  React/Reply buttons scoped to that exact message ─▶ verified in Instagram's data
```

The **collect** and **act** scripts ([`scripts/`](scripts/)) do the predictable browser work in
one call each. Claude only does the judgment. A typical run is about 6 tool calls, and an idle run
(nothing new) is 3. The plugin ships its own Playwright MCP server, so installing the plugin installs
the browser tools too.

**Watch mode** (`"mode": "watch"`, or say "run reel reactor in watch mode") does the same run step by
step with visible clicks and a one-line narration per step. It's made for screen recordings.

---

## End-to-end: from repo link to reactions on autopilot

About 10 minutes. These steps are for the **Claude desktop app** (Code tab) on Windows or Mac.

### 0. You need
- The **Claude desktop app**, signed in, with the **Code** tab
- **Node.js 18+** from https://nodejs.org (LTS). After installing it, **fully quit and reopen** the Claude app.
- **Google Chrome** or Microsoft Edge
- A **throwaway Instagram account**, plus 1 or 2 friends who will send it reels

### 1. Start a session
In the Code tab, start a new session in any folder (an empty folder like `Documents/reel-reactor`
is fine). Reel Reactor keeps its own files in `~/.reel-reactor/`, not in that folder.

### 2. Install the plugin
In the session's prompt box, type these two commands, one at a time:

```
/plugin marketplace add atinder-harika/dm-reaction-skill
```
```
/plugin install reel-reactor@reel-reactor-marketplace
```

Pick **user** scope when it asks, so it's available in every session.

<details>
<summary>Other ways to install</summary>

- **Desktop UI:** click **+** next to the prompt box → **Plugins** → **Browse / Manage plugins**
  (the marketplace has to be added first, as above).
- **Terminal** (Claude Code CLI):
  ```bash
  claude plugin marketplace add atinder-harika/dm-reaction-skill
  claude plugin install reel-reactor@reel-reactor-marketplace
  ```
- **From a clone, no install:** `git clone https://github.com/atinder-harika/dm-reaction-skill`,
  then `claude --plugin-dir ./dm-reaction-skill`.
</details>

### 3. Start a fresh session
Plugins and their browser tools load when a session starts. Open a **new session** (same folder is fine).

### 4. Run setup
Type:
```
/reel-reactor:setup
```
(or just say "set up reel reactor"). Claude will:
1. check Node and the bundled browser tools
2. create `~/.reel-reactor/config.json` and ask for your friends' usernames and run times
3. open a browser window on Instagram. **Log in yourself** with the throwaway account and tick
   "Save login info". Claude never sees or types your password, and the login is saved in
   `~/.reel-reactor/playwright-profile/` for future runs.

Approve the permission prompts as they come up. Choose "always allow" for the browser tools
so scheduled runs don't get stuck waiting on you.

### 5. Dry run
Have a friend DM a couple of reels to the throwaway account, then type:
```
/reel-reactor:react
```
The first run is a **dry run**. It reads the DMs and comments, then *probes* the page: it finds
each reel's bubble, its React button and the emoji, but clicks nothing. Then it prints what it
*would* do:

| friend | reel | mood | action | result |
|---|---|---|---|---|
| sam | C9xYz… | funny | 😂 | probe_ok |
| sam | C9aBc… | hype | none (roll 93) | — |
| alex | C8qRs… | wholesome | 😍 + reply: "the dog's face at the end lmao" | probe_ok |

Dry runs mark nothing as processed, so a dry run's reel will turn up as new again on the next run.
To re-check a thread you've already opened, say **"run reel reactor with force"**.

### 6. Go live
Say **"set dryRun to false in my reel reactor config"** (or edit `~/.reel-reactor/config.json`),
then have a friend send a fresh reel and run `/reel-reactor:react`. Check the Instagram app:
reactions appear under the reels in the DM thread, and the reply appears in the chat, quoting the
standout reel. Each one is shown as `verified` in the table only after the script has read it back
from Instagram's own data.

Run it once more right away. It should finish in seconds with **"Nothing new"**.

### 6b. Record it (watch mode)
For a video, say **"run reel reactor in watch mode"**. It goes step by step, with visible hovers and
clicks and a one-line narration per step. It's slower, but much more fun to watch.

### 7. Put it on a schedule
Say **"schedule reel reactor"** and Claude will set up the app's Scheduled tasks for you.
To do it by hand: **Code** tab → **Scheduled** (sidebar) → **New task**:
- **Prompt:** `/reel-reactor:react`
- **Advanced settings:** **Only on this computer**
- **Folder:** the one from step 1
- **Schedule:** Daily at 09:00. Repeat for 12:00 and 17:00, or use one **Custom** cron: `0 9,12,17 * * *`
- **Model:** pick **Sonnet** or **Haiku** if the task lets you choose. The scripts do the heavy
  lifting, so a smaller model is plenty and costs much less.

Click **Run now** once to confirm it works unattended.
Scheduled tasks run only while the Claude app is open and the computer is awake. A browser window
pops up for each run.

### Stop it
Pause or delete the tasks under **Code → Scheduled**. To remove everything:
`/plugin uninstall reel-reactor`, then delete `~/.reel-reactor/`.

---

## Config: `~/.reel-reactor/config.json`

| key | default | what it does |
|---|---|---|
| `friends` | `[]` | Instagram usernames whose DMs get processed. Nobody else is touched. |
| `schedule` | `["09:00","12:00","17:00"]` | Daily run times (used when scheduling) |
| `mode` | `fast` | `fast` (scripts) or `watch` (step-by-step, for recordings) |
| `ratios` | `{emoji: .8, sticker: .1, none: .1}` | Chance of each action per reel |
| `stickersEnabled` | `false` | Stickers are a v2 feature; while off, the sticker share becomes emoji |
| `stickers` | `[]` | Reserved for v2 |
| `defaultEmoji` | `😂` | Used when a reel has no comments |
| `emojiPalette` | 8 emojis | Emojis Claude may pick from |
| `repliesPerRun` | `1` | Funny replies to the friend per run (0 or 1) |
| `maxReelsPerRun` | `15` | Safety cap. Leftovers are picked up next run. |
| `dryRun` | `true` | Read and probe only, no clicks |
| `browser` | *(unset = Chrome)* | Optional: `msedge`, `firefox` or `webkit`. Start a new session after changing it. |

Run state lives in `~/.reel-reactor/state.json`: `lastRun`, `processedReelIds`, and
`recheckFriends` (threads that still had unfinished reels, checked next run even if they're read).
A reel counts as done once it's in `processedReelIds` or already carries your reaction. There's no
time cutoff, so nothing is lost when a run is interrupted.

### How the data is read
`collect.js` replays the same GraphQL queries Instagram's own DM page makes (`PolarisDirectInboxQuery`,
`IGDThreadDetailQuery`) inside your logged-in browser, plus `/api/v1/media/<id>/info|comments`. These
are undocumented and can change at any time. When they break, fast mode falls back to watch mode.

## Troubleshooting

| symptom | fix |
|---|---|
| `/reel-reactor:setup` isn't recognised | Start a new session after installing. Check `/plugin` → Installed. |
| "no browser tools" | Install Node, **fully restart the app**, then start a new session. Type `/mcp` and check `plugin:reel-reactor:playwright` for the error. |
| Browser won't launch / Chrome not found | Add `"browser": "msedge"` to the config, then start a new session |
| Asked to log in every run | Log in from the browser window that setup opens and tick "Save login info". Don't delete `~/.reel-reactor/playwright-profile/`. |
| Scheduled run did nothing | The app must be open and the PC awake. Open the task → **History**. Approve tools with "always allow" during **Run now**. |
| A reel got skipped / `not_found` | It's retried next run. If it keeps happening, Instagram's UI changed: the selectors are at the top of `scripts/act.js`. |
| "data feed didn't work" | Instagram changed a query. The run falls back to watch mode. Update `scripts/collect.js`. |
| `wrong_message` | The run stops on purpose. Remove that reaction by hand in the app and open an issue. |
| Checkpoint / "suspicious activity" | The run stops on purpose. Clear it yourself in the browser and run less often. |

## Without the desktop app (CLI only)

Install with the terminal commands above, then run `claude` and use the same `/reel-reactor:*` commands.
For scheduling:

- **Windows** (Task Scheduler):
  ```powershell
  powershell -ExecutionPolicy Bypass -File scripts\schedule-windows.ps1          # create tasks
  powershell -ExecutionPolicy Bypass -File scripts\schedule-windows.ps1 -Remove  # delete them
  ```
- **macOS / Linux** (cron), one line per time:
  ```
  0 9 * * * cd ~ && claude -p "/reel-reactor:react" --model sonnet --allowedTools "mcp__plugin_reel-reactor_playwright__*" Read Write Edit "Bash(node -e:*)" >> ~/.reel-reactor/run.log 2>&1
  ```

Headless runs pre-approve only the bundled browser, file read/write for the config and state, and
`node -e` for the dice rolls. Logs go to `~/.reel-reactor/run.log`.

## Repo layout

```
.claude-plugin/plugin.json        plugin manifest
.claude-plugin/marketplace.json   makes this repo installable with /plugin
.mcp.json                         bundled Playwright MCP server
skills/react/SKILL.md             one run: collect → mood/emoji/reply → act (+ watch mode)
scripts/collect.js                read-only: unread check, new reels, reel metadata + top comments
scripts/act.js                    scoped reactions + reply, verified against thread data
skills/setup/SKILL.md             checks, config, login, scheduling
config/reel-reactor.example.json  config template
scripts/playwright-mcp.mjs        launches Playwright MCP with a persistent profile
scripts/*.ps1                     CLI scheduling on Windows
```

## Roadmap

- [ ] Stickers from a user-chosen list (~10% of reels)
- [ ] Per-friend emoji preferences
- [ ] Headless mode after first login

## License

MIT
