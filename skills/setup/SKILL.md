---
name: setup
description: First-time setup for Reel Reactor. Checks that the plugin's Playwright browser tools are available (and explains how to fix it if not), creates the config, walks the user through a manual Instagram login, and helps schedule runs. Use when the user says "set up reel reactor" or the react skill reports missing config or login.
---

# Reel Reactor setup

Go through these checks in order. Report each one as ✅ or ❌ with a one-line fix.
Don't move on past a ❌ that blocks later steps.

## 1. Node / npx
Run `node --version`. Node 18 or newer is required. If it's missing, tell the user to install
the LTS from https://nodejs.org, **fully quit and reopen the Claude app**, and run setup again.

## 2. Browser tools (bundled Playwright MCP)
The plugin ships its own Playwright MCP server (`.mcp.json` at the plugin root, launched by
`scripts/playwright-mcp.mjs`). Its tools are named `mcp__plugin_reel-reactor_playwright__*`,
for example `mcp__plugin_reel-reactor_playwright__browser_navigate`.

- If those tools are available, ✅.
- If they're missing, the plugin was probably installed during this session. Tell the user to
  start a **new session** (or restart the app) and say "set up reel reactor" again.
- If they're still missing after a restart, ask the user to type `/mcp` and check the
  `plugin:reel-reactor:playwright` server. The usual causes are Node missing from PATH or a
  failed first `npx` download, and the `/mcp` panel shows the error.
- Fallback (only if the bundled server won't start): a standalone Playwright MCP also works.
  The react skill accepts `mcp__playwright__*` tools too. Command, from a terminal:
  `claude mcp add playwright --scope user -- npx @playwright/mcp@latest --user-data-dir ~/.reel-reactor/playwright-profile`

Stop here if no browser tools are loaded. The remaining steps need the browser.

## 3. Config
Make the folder `~/.reel-reactor/` (`%USERPROFILE%\.reel-reactor\` on Windows) if it doesn't exist.
If `config.json` isn't there, copy `config/reel-reactor.example.json` from the plugin root
(two levels up from this skill's base directory) to `~/.reel-reactor/config.json`.

Then ask the user for:
- the Instagram usernames of the friends to whitelist (without `@`) → `friends`
- run times, 2 to 4 per day in 24h `HH:MM` → `schedule` (default `09:00`, `12:00`, `17:00`)

Write those into `config.json`. Leave `dryRun: true` for now and tell the user that the
first run is a dry run on purpose.

## 4. Instagram login (manual, done by the user)
`browser_navigate` to `https://www.instagram.com/`. A separate browser window opens.
If it shows the logged-in feed, ✅. Otherwise tell the user:

> A browser window is open on Instagram. Log in **yourself** with your throwaway account,
> tick "Save login info" if it asks, then tell me when you're done.

Never type credentials yourself. Once the user confirms, navigate again and snapshot to check.
If the browser fails to launch with a "chrome not found" style error, set `"browser": "msedge"`
in `config.json` (Windows always has Edge), ask the user to start a new session, and try again.

## 5. Test run
Suggest running `/reel-reactor:react` now (it's a dry run). When the table looks right,
set `dryRun` to `false` in `config.json`.

## 6. Scheduling
**Claude desktop app (recommended):** use the app's Scheduled tasks, which run while the app
is open and the computer is awake. If you have a scheduled-task tool, offer to create one task
per time in `config.schedule` yourself. Each task:
- prompt: `/reel-reactor:react`
- runs on this computer (local), in the session's current folder
- schedule: daily at that time (or one custom cron task like `0 9,12,17 * * *`)
- model: Sonnet or Haiku when the task lets you choose. The scripts do the browser work, so a smaller model is enough.

Otherwise the user creates them: **Code** tab → **Scheduled** in the sidebar → **New task** →
paste `/reel-reactor:react` → under **Advanced settings** choose **Only on this computer** → pick
a folder and **Daily** at the time → **Create**. Tell the user to use **Run now** once and approve
the browser tools with "always allow" so later unattended runs don't stop at a prompt.

**Terminal / no desktop app:** on Windows, `scripts/schedule-windows.ps1` (plugin root) registers
Task Scheduler tasks that run `scripts/run-once.ps1`; add `-Remove` to delete them.
On macOS/Linux, give crontab lines, one per time, e.g. for 09:00:
```
0 9 * * * cd ~ && claude -p "/reel-reactor:react" --model sonnet --allowedTools "mcp__plugin_reel-reactor_playwright__*" Read Write Edit "Bash(node -e:*)" >> ~/.reel-reactor/run.log 2>&1
```
