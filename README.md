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
Claude app Scheduled task (9am / 12pm / 5pm)  ─▶  /reel-reactor:react
   └─▶ Reel Reactor's own browser window (separate profile, logged in once by you)
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

## Commands

| command | what it does |
|---|---|
| `/reel-reactor:setup` | first-time setup, or after an update: checks, config upgrade, login, schedule |
| `/reel-reactor:react` | run once now (this is also what the scheduled task runs) |
| `/reel-reactor:status` | last run, reels handled, friends, dry run, mode, schedule, next run, logged in? |
| `/reel-reactor:friends [list\|add\|remove] <username...>` | manage the whitelist (`@` and case don't matter) |
| `/reel-reactor:schedule [HH:MM ...\|off\|on]` | show or set 2 to 4 daily run times, pause or resume. Keeps the app's scheduled task in sync. |
| `/reel-reactor:dry-run [on\|off]` | show or toggle rehearsal mode: reads and probes, sends nothing |

Examples:

```
/reel-reactor:friends add @sam alex.j
/reel-reactor:schedule 08:30 13:30 21:00
/reel-reactor:schedule off
/reel-reactor:dry-run on
```

---

## End-to-end: from repo link to reactions on autopilot

About 10 minutes. These steps are for the **Claude desktop app** (Code tab) on Windows or Mac.

### 0. You need
- The **Claude desktop app**, signed in, with the **Code** tab
- **Node.js 18+** from https://nodejs.org (LTS). After installing it, **fully quit and reopen** the Claude app.
- **Google Chrome** or Microsoft Edge installed. Reel Reactor opens **its own window with its own
  profile**; your normal browser and its logins are never touched.
- A **throwaway Instagram account**, plus 1 or 2 friends who will send it reels

### 1. Start a session
In the Code tab, start a new session in any folder. Reel Reactor keeps its files in `~/.reel-reactor/`,
not in that folder.

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
```
/reel-reactor:setup
```
Claude will:
1. check Node and the bundled browser tools
2. create `~/.reel-reactor/config.json` and ask which friends to whitelist
3. open **Reel Reactor's own browser window** on Instagram. **Log in yourself** with the throwaway
   account and tick "Save login info". Claude never sees or types your password, and the login stays
   in `~/.reel-reactor/playwright-profile/` for future runs.
4. create the scheduled task (09:00, 12:00 and 17:00 by default)

Approve the permission prompts as they come up. Choose "always allow" for the browser tools and
`node`, so scheduled runs don't get stuck waiting on you.

### 5. First run
Have a friend DM a couple of reels to the throwaway account, then:
```
/reel-reactor:react
```
New installs run **live**. Check the Instagram app: reactions appear under the reels in the DM
thread, and the reply appears in the chat, quoting the standout reel. Each line shows `verified` only
after the script has read it back from Instagram's own data.

| friend | reel | mood | action | result |
|---|---|---|---|---|
| sam | C9xYz… | funny | 😂 | verified |
| sam | C9aBc… | hype | none (roll 93) | — |
| alex | C8qRs… | wholesome | 😍 + reply: "the dog's face at the end lmao" | verified |

Run it once more right away. It should finish in seconds with **"Nothing new"**.

**Want a rehearsal first?** `/reel-reactor:dry-run on`, then `/reel-reactor:react`. It reads everything
and *probes* the page (finds each bubble, its React button and the emoji) but clicks and sends nothing.
`/reel-reactor:dry-run off` to go live. To re-check threads you've already opened, say
**"run reel reactor with force"**.

### 6. Record it (watch mode)
For a video, say **"run reel reactor in watch mode"**. It goes step by step, with visible hovers and
clicks and a one-line narration per step. It's slower, but much more fun to watch.

### 7. The schedule
Setup already created the task. Change it any time with `/reel-reactor:schedule 08:30 13:30 21:00`,
pause it with `/reel-reactor:schedule off`, and check it with `/reel-reactor:status`. The task's prompt
is just `/reel-reactor:react` plus the guardrails, so it never goes stale when the plugin updates.

- **Model:** scheduled runs use the app's default model. To use a cheaper one, open
  **Code → Scheduled → Reel Reactor** and pick **Sonnet** or **Haiku** if a model option is shown.
  The scripts do the heavy lifting, so a smaller model is plenty.
- Click **Run now** once to confirm it works unattended.
- Scheduled tasks run only while the Claude app is open and the computer is awake. A browser window
  pops up for each run.

### Updating
- **Easiest:** `/plugin` → **Marketplaces** → `reel-reactor-marketplace` → **Enable auto-update**.
  New versions download in the background; run `/reload-plugins` (or start a new session) when told.
- **Manually:** `/plugin marketplace update reel-reactor-marketplace`, then `/plugin` → **Installed** →
  `reel-reactor` → **Update now**. If that option isn't there, uninstall and reinstall. Your config,
  state and login in `~/.reel-reactor/` are kept.
- After updating, run `/reel-reactor:setup` once. It upgrades your config (and says what changed) and
  updates the existing scheduled task instead of adding a second one. If an update changes what gets
  sent, the first run after it is automatically a dry run.

### Stop it
`/reel-reactor:schedule off` pauses it. To remove everything: delete the task under **Code → Scheduled**,
`/plugin uninstall reel-reactor@reel-reactor-marketplace`, then delete `~/.reel-reactor/`.

---

## Config: `~/.reel-reactor/config.json`

You shouldn't need to edit it: the commands above cover the common settings.

| key | default | what it does | command |
|---|---|---|---|
| `friends` | `[]` | Instagram usernames whose DMs get processed. Nobody else is touched. | `friends` |
| `schedule` | `["09:00","12:00","17:00"]` | Daily run times (2 to 4) | `schedule` |
| `scheduleEnabled` | `true` | `false` = paused | `schedule off/on` |
| `dryRun` | `false` | Read and probe only, no clicks | `dry-run` |
| `mode` | `fast` | `fast` (scripts) or `watch` (step-by-step, for recordings) | |
| `ratios` | `{emoji: .8, sticker: .1, none: .1}` | Chance of each action per reel | |
| `stickersEnabled` | `false` | Stickers aren't built yet; while off, the sticker share becomes emoji | |
| `stickers` | `[]` | Reserved | |
| `defaultEmoji` | `😂` | Used when a reel has no comments | |
| `emojiPalette` | 8 emojis | Emojis Claude may pick from | |
| `repliesPerRun` | `1` | Funny replies to the friend per run (0 or 1) | |
| `maxReelsPerRun` | `15` | Safety cap. Leftovers are picked up next run. | |
| `browser` | *(unset = Chrome)* | Optional: `msedge`, `firefox` or `webkit`. Still a separate profile. Start a new session after changing it. | |
| `configVersion` | `3` | Set by the plugin, used for upgrades | |

Run state lives in `~/.reel-reactor/state.json`: `lastRun`, `processedReelIds`, and
`recheckFriends` (threads that still had unfinished reels, checked next run even if they're read).
A reel counts as done once it's in `processedReelIds` or already carries your reaction. There's no
time cutoff, so nothing is lost when a run is interrupted. Browser snapshots and logs go to
`~/.reel-reactor/output/`, not the folder your session runs in.

### How the data is read
`collect.js` replays the same GraphQL queries Instagram's own DM page makes (`PolarisDirectInboxQuery`,
`IGDThreadDetailQuery`) inside the logged-in browser, plus `/api/v1/media/<id>/info|comments`. These
are undocumented and can change at any time. When they break, fast mode falls back to watch mode.

The bundled browser server runs with `--allow-unrestricted-file-access` so it can load these scripts
from the plugin folder whatever folder your session is in. That also lets the browser tools read other
local files, so only run it with the throwaway account it's meant for.

## Troubleshooting

| symptom | fix |
|---|---|
| `/reel-reactor:setup` isn't recognised | Start a new session after installing. Check `/plugin` → Installed. |
| "no browser tools" | Install Node, **fully restart the app**, then start a new session. Type `/mcp` and check `plugin:reel-reactor:playwright` for the error. |
| Browser won't launch / Chrome not found | Add `"browser": "msedge"` to the config, then start a new session |
| Asked to log in every run | Log in from the browser window that setup opens and tick "Save login info". Don't delete `~/.reel-reactor/playwright-profile/`. `/reel-reactor:status` shows whether you're logged in. |
| "File access denied … outside allowed roots" | You're on an old version (before 0.3.0) or a standalone Playwright MCP. Update the plugin and start a new session. |
| Two scheduled tasks | Run `/reel-reactor:schedule` again: it updates `reel-reactor` and pauses leftovers, which you can delete under **Code → Scheduled**. |
| Scheduled run did nothing | The app must be open and the PC awake. Open the task → **History**. Approve tools with "always allow" during **Run now**. |
| A reel got skipped / `not_found` | It's retried next run. If it keeps happening, Instagram's UI changed: the selectors are at the top of `scripts/act.js`. |
| "data feed didn't work" | Instagram changed a query. The run falls back to watch mode. Update `scripts/collect.js`. |
| `wrong_message` | The run stops on purpose. Remove that reaction by hand in the app and open an issue. |
| Checkpoint / "suspicious activity" | The run stops on purpose. Clear it yourself in the browser and run less often. |

## Without the desktop app (CLI only)

Install with the terminal commands above, then run `claude` and use the same `/reel-reactor:*` commands.
`/reel-reactor:schedule` saves the times; to run them:

- **Windows** (Task Scheduler):
  ```powershell
  powershell -ExecutionPolicy Bypass -File scripts\schedule-windows.ps1          # create tasks
  powershell -ExecutionPolicy Bypass -File scripts\schedule-windows.ps1 -Remove  # delete them
  ```
- **macOS / Linux** (cron), one line per time:
  ```
  0 9 * * * cd ~ && claude -p "/reel-reactor:react" --model sonnet --allowedTools "mcp__plugin_reel-reactor_playwright__*" Read Write Edit "Bash(node:*)" >> ~/.reel-reactor/run.log 2>&1
  ```

Headless runs pre-approve only the bundled browser, file read/write for the config and state, and
`node` (config helper and dice rolls). Logs go to `~/.reel-reactor/run.log`.

## Repo layout

```
.claude-plugin/plugin.json        plugin manifest (bump version on every shipped change)
.claude-plugin/marketplace.json   makes this repo installable with /plugin
.mcp.json                         bundled Playwright MCP server
skills/react/SKILL.md             one run: collect → mood/emoji/reply → act (+ watch mode)
skills/setup/SKILL.md             checks, config upgrade, login, scheduled task
skills/{status,friends,schedule,dry-run}/SKILL.md   the slash commands
scripts/collect.js                read-only: unread check, new reels, reel metadata + top comments
scripts/act.js                    scoped reactions + reply, verified against thread data
scripts/rr.mjs                    config helper behind the commands: migrate, status, friends, schedule, dry-run
scripts/playwright-mcp.mjs        launches Playwright MCP (own profile, output dir, file access, no code echo)
scripts/*.ps1                     CLI scheduling on Windows
config/reel-reactor.example.json  config template and defaults
```

## Roadmap

- [ ] Stickers from a user-chosen list (~10% of reels)
- [ ] Per-friend emoji preferences
- [ ] Headless mode after first login

## License

MIT
