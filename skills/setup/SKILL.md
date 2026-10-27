---
name: setup
description: First-time setup for Reel Reactor. Checks that the Playwright MCP is installed (and explains how to install it if not), creates the config, walks the user through a manual Instagram login, and optionally schedules runs. Use when the user says "set up reel reactor" or the react skill reports missing config or login.
---

# Reel Reactor setup

Go through these checks in order. Report each one as ✅ or ❌ with a one-line fix.
Don't move on past a ❌ that blocks later steps.

## 1. Node / npx
Run `node --version` and `npx --version`. Node 18 or newer is required. If it's missing,
point the user to https://nodejs.org (LTS) and stop.

## 2. Playwright MCP
Check whether tools named `mcp__playwright__*` (for example `mcp__playwright__browser_navigate`)
are available in this session. If you're not sure, run `claude mcp list` and look for `playwright`.

If it's missing, tell the user to run **one** of these and then restart Claude Code.

macOS / Linux:
```bash
claude mcp add playwright --scope user -- npx @playwright/mcp@latest --user-data-dir ~/.reel-reactor/playwright-profile
```

Windows (native, PowerShell); `cmd /c` is needed for npx-based MCP servers on Windows:
```powershell
claude mcp add playwright --scope user -- cmd /c npx @playwright/mcp@latest --user-data-dir "$env:USERPROFILE\.reel-reactor\playwright-profile"
```

`--user-data-dir` gives the browser a persistent profile, so the user logs in to Instagram
once and every scheduled run reuses that session. If the Playwright MCP is already installed
without it, suggest removing it (`claude mcp remove playwright`) and adding it again as above.

Stop here if the tools aren't loaded. The remaining steps need the browser.

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
`browser_navigate` to `https://www.instagram.com/`. If it shows the logged-in feed, ✅.
Otherwise tell the user:

> A browser window is open on Instagram. Log in **yourself** with your throwaway account,
> tick "Save login info" if it asks, then tell me when you're done.

Never type credentials yourself. Once the user confirms, navigate again and snapshot to check.

## 5. Test run
Suggest running the `reel-reactor:react` skill now (dry run). When the table looks right,
set `dryRun` to `false` in `config.json`.

## 6. Scheduling (optional)
Claude Code doesn't run on its own, so the operating system starts it at the configured times.

**Windows:** offer to run the bundled script from the plugin root. It registers one Task Scheduler
task per time in `config.schedule`, and each one calls `scripts/run-once.ps1`:
```powershell
powershell -ExecutionPolicy Bypass -File "<plugin root>\scripts\schedule-windows.ps1"
```
Remove the tasks again with the same command plus `-Remove`.

**macOS / Linux:** give the user crontab lines, one per time. For example, for 09:00:
```
0 9 * * * cd ~ && claude --plugin-dir "<plugin root>" -p "Use the reel-reactor:react skill to run Reel Reactor now." --allowedTools "mcp__playwright,Read,Write,Edit,Bash(node -e:*)" >> ~/.reel-reactor/run.log 2>&1
```

Remind the user that the computer has to be awake and logged in at those times, and a browser
window will pop up during each run.
