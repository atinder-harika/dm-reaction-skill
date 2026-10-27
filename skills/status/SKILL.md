---
name: status
description: Show Reel Reactor's status - last run, reels handled, friends, dry-run state, mode, schedule and next run, and whether the browser is still logged in to Instagram.
argument-hint: ""
---

# /reel-reactor:status

1. The plugin root is two levels up from this skill's base directory. Run:
   `node "<plugin root>/scripts/rr.mjs" status`
   If it says there's no config, tell the user to run `/reel-reactor:setup` and stop.
2. **Login check (no navigation, nothing is clicked).** Call `browser_run_code_unsafe` (or
   `browser_run_code` if that's the one available) from the plugin's Playwright server
   (`mcp__plugin_reel-reactor_playwright__*`) with this `code`:
   ```js
   async (page) => { const c = await page.context().cookies('https://www.instagram.com'); const s = c.find((x) => x.name === 'sessionid'); return { loggedIn: !!s && (s.expires === -1 || s.expires * 1000 > Date.now()) }; }
   ```
   If the browser tools aren't loaded, report login as "unknown (start a new session)".
3. **Scheduled task:** if `list_scheduled_tasks` is available, find the tasks whose `taskId` starts
   with `reel-reactor` and note whether each is enabled and its `nextRunAt`. Flag duplicates, and flag
   a task whose prompt doesn't start with `/reel-reactor:react` as stale (fix with `/reel-reactor:schedule`).
4. Print the script's table, then add two rows in the same style:
   `Logged in` (yes / **no, run /reel-reactor:setup** / unknown) and
   `Scheduled task` (e.g. `on, next Wed 09:03`, `paused`, `none, run /reel-reactor:schedule`).
   Keep it to the table. No extra commentary unless something needs fixing.
