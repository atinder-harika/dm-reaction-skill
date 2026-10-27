# 🎬 Reel Reactor

> Your friends send you 40 reels a day. Reel Reactor reacts to them for you.

A Claude Code plugin that opens your Instagram DMs a few times a day, finds the reels your
whitelisted friends sent you, reads the room (the top comments), and reacts with a fitting emoji.
Once per run it also leaves a short funny comment on the standout reel.

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
         └─▶ bundled Playwright browser ─▶ instagram.com/direct
               ├─ new reels from whitelisted friends only
               ├─ read top comments ─▶ mood ─▶ emoji   (~80-90% of reels)
               ├─ leave a few alone                   (~10%, looks human)
               └─ standout reel ─▶ 1 short funny comment
```

There's no bot code. The behaviour lives in [`skills/react/SKILL.md`](skills/react/SKILL.md) and
Claude drives a real browser. The plugin ships its own Playwright MCP server, so installing the
plugin installs the browser tools too.

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
The first run is a **dry run**: it opens the DMs, reads the comments and prints what it *would* do:

| friend | reel | mood | action |
|---|---|---|---|
| sam | C9xYz… | funny | 😂 |
| sam | C9aBc… | hype | none (roll 93) |
| alex | C8qRs… | wholesome | 😍 + comment: "the dog's face at the end lmao" |

### 6. Go live
Say **"set dryRun to false in my reel reactor config"** (or edit `~/.reel-reactor/config.json`),
then run `/reel-reactor:react` again. Check the Instagram app: reactions appear under the reels
in the DM thread, and the comment appears on the standout reel.

Run it once more right away. It should report **nothing new**, because each reel is handled only once.

### 7. Put it on a schedule
Say **"schedule reel reactor"** and Claude will set up the app's Scheduled tasks for you.
To do it by hand: **Code** tab → **Scheduled** (sidebar) → **New task**:
- **Prompt:** `/reel-reactor:react`
- **Advanced settings:** **Only on this computer**
- **Folder:** the one from step 1
- **Schedule:** Daily at 09:00. Repeat for 12:00 and 17:00, or use one **Custom** cron: `0 9,12,17 * * *`

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
| `ratios` | `{emoji: .8, sticker: .1, none: .1}` | Chance of each action per reel |
| `stickersEnabled` | `false` | Stickers are a v2 feature; while off, the sticker share becomes emoji |
| `stickers` | `[]` | Reserved for v2 |
| `defaultEmoji` | `😂` | Used when a reel has no comments |
| `emojiPalette` | 8 emojis | Emojis Claude may pick from |
| `commentsPerRun` | `1` | Funny comments per run |
| `maxReelsPerRun` | `15` | Safety cap |
| `dryRun` | `true` | Read only, no clicks |
| `browser` | *(unset = Chrome)* | Optional: `msedge`, `firefox` or `webkit`. Start a new session after changing it. |

Run state (`lastRun`, processed reel IDs) lives in `~/.reel-reactor/state.json`.

## Troubleshooting

| symptom | fix |
|---|---|
| `/reel-reactor:setup` isn't recognised | Start a new session after installing. Check `/plugin` → Installed. |
| "no browser tools" | Install Node, **fully restart the app**, then start a new session. Type `/mcp` and check `plugin:reel-reactor:playwright` for the error. |
| Browser won't launch / Chrome not found | Add `"browser": "msedge"` to the config, then start a new session |
| Asked to log in every run | Log in from the browser window that setup opens and tick "Save login info". Don't delete `~/.reel-reactor/playwright-profile/`. |
| Scheduled run did nothing | The app must be open and the PC awake. Open the task → **History**. Approve tools with "always allow" during **Run now**. |
| A reel got skipped | Instagram's UI changed. The reason is in the summary table. Wording fixes go in `skills/react/SKILL.md`. |
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
  0 9 * * * cd ~ && claude -p "/reel-reactor:react" --allowedTools "mcp__plugin_reel-reactor_playwright__*" Read Write Edit "Bash(node -e:*)" >> ~/.reel-reactor/run.log 2>&1
  ```

Headless runs pre-approve only the bundled browser, file read/write for the config and state, and
`node -e` for the dice rolls. Logs go to `~/.reel-reactor/run.log`.

## Repo layout

```
.claude-plugin/plugin.json        plugin manifest
.claude-plugin/marketplace.json   makes this repo installable with /plugin
.mcp.json                         bundled Playwright MCP server
skills/react/SKILL.md             one run: DMs → mood → emoji → comment
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
