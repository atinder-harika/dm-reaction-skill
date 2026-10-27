---
name: setup
description: First-time setup or upgrade for Reel Reactor. Checks Node and the plugin's browser tools, creates or upgrades the config, walks the user through a manual Instagram login in the plugin's own browser, and creates or updates the scheduled task. Use when the user says "set up reel reactor", after a plugin update, or when the react skill reports missing config or login.
---

# Reel Reactor setup

Go through these steps in order. Report each as ✅ or ❌ with a one-line fix. Don't move past a ❌
that blocks later steps. The plugin root is two levels up from this skill's base directory.
Keep the whole report short.

## 1. Node
Run `node --version`. Node 18 or newer is required. If it's missing, tell the user to install the LTS
from https://nodejs.org, **fully quit and reopen the Claude app**, and run setup again.

## 2. Browser tools (bundled Playwright MCP)
The plugin ships its own Playwright MCP server (`.mcp.json`, launched by `scripts/playwright-mcp.mjs`).
Its tools are named `mcp__plugin_reel-reactor_playwright__*`.

- Available → ✅.
- Missing → the plugin was probably installed or updated during this session. Tell the user to start a
  **new session** (or run `/reload-plugins`) and run setup again.
- Still missing after that → ask the user to type `/mcp` and check `plugin:reel-reactor:playwright`.
  Usual causes: Node not on PATH, or the first `npx` download failed.

Stop here if no browser tools are loaded.

## 3. Config (create or upgrade)
Run `node "<plugin root>/scripts/rr.mjs" migrate`. It creates `~/.reel-reactor/config.json` from the
example, or upgrades an existing one from an older plugin version (adds new keys, renames old ones). Show
its "Config updated" lines, if any, so the user sees what changed.

Then check `node "<plugin root>/scripts/rr.mjs" friends`. If no friends are whitelisted, ask for the
Instagram usernames of the friends whose reels should get reactions, and add them with
`node "<plugin root>/scripts/rr.mjs" friends add <usernames>`. Don't hand-edit config.json.

## 4. Instagram login (done by the user, in the plugin's own browser)
Tell the user this **before** anything opens:

> Reel Reactor uses **its own browser window with its own login**, kept in `~/.reel-reactor/playwright-profile`.
> Your normal Chrome or Edge, and whatever you're logged into there, isn't touched or reused.
> Log in there once with your **throwaway** account and it stays logged in for future runs.

Then `browser_navigate` to `https://www.instagram.com/`. If it shows the logged-in feed, ✅. Otherwise:

> The Reel Reactor browser window is open on Instagram. Log in **yourself**, tick "Save login info"
> if it asks, and tell me when you're done.

Never type credentials yourself. Once the user confirms, navigate again and check.
If the browser won't launch ("chrome not found" or similar), add `"browser": "msedge"` to `config.json`
(Edge is on every Windows PC). It's still a separate profile, not the user's normal Edge. Then ask the
user to start a new session and run setup again.

## 5. Schedule
Read `skills/schedule/SKILL.md` (plugin root) and follow its steps 2 and 3, using the `TASK_SPEC` from
`node "<plugin root>/scripts/rr.mjs" schedule`. That creates the scheduled task, or **updates the
existing one** (for example a task made by an older version) instead of making a duplicate. If the user
wants different times, use `/reel-reactor:schedule HH:MM HH:MM …` instead.

## 6. Done
Finish with a short summary and the commands they can use from now on:

| command | what it does |
|---|---|
| `/reel-reactor:react` | run once now |
| `/reel-reactor:status` | last run, friends, schedule, login |
| `/reel-reactor:friends add\|remove\|list` | manage the whitelist |
| `/reel-reactor:schedule 09:00 12:00 17:00` / `off` / `on` | change or pause the run times |
| `/reel-reactor:dry-run on\|off` | read-only rehearsal mode |

New installs run **live**. Offer a rehearsal first as an option ("want a dry run first? `/reel-reactor:dry-run on`,
then `/reel-reactor:react`"), but don't make it a required step. If step 3 reported that dry run was turned
on by an upgrade, say the next run is a rehearsal and how to go live afterwards.
