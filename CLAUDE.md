# Reel Reactor: project notes

A fun, one-off Claude Code **plugin** (for a LinkedIn post and GitHub). It drives Instagram through the
**Playwright MCP** and reacts to reels that whitelisted friends DM the user, plus one DM reply per run.
It's educational, probably against Instagram's ToS, and only ever used on a throwaway account.

## Layout
- `.claude-plugin/plugin.json`: plugin manifest (name `reel-reactor`, **version**: see "Releasing changes")
- `.claude-plugin/marketplace.json`: single-plugin marketplace so the repo installs with `/plugin`
- `skills/react/SKILL.md`: **the core.** Fast mode: `rr.mjs migrate --quiet` → collect.js → Claude judges mood/emoji
  (RNG via `node -e`) and writes one reply to the friend about the standout reel → act.js → write state → summary table.
  Watch mode: the same run step by step with visible clicks (for videos, and as the fallback).
- `skills/setup/SKILL.md`: Node + browser tools check, `rr.mjs migrate` (create/upgrade config), friends, manual login
  in the plugin's **own** browser profile (says so up front), then the scheduled task (create or update, never duplicate).
- Slash commands = skills with `$ARGUMENTS` (user-only via `disable-model-invocation`, except status):
  `skills/status`, `skills/friends`, `skills/schedule`, `skills/dry-run`. They call `scripts/rr.mjs` and print its output.
- `scripts/rr.mjs`: config helper (no deps): `migrate`, `status`, `dry-run`, `friends`, `schedule`, `task-spec`.
  Owns config migrations (`configVersion`, currently 3) and the scheduled-task spec (`TASK_PROMPT` = just
  `/reel-reactor:react` plus guardrails, so tasks never go stale). `REEL_REACTOR_HOME` overrides `~/.reel-reactor` for tests.
- `scripts/collect.js` (read-only) and `scripts/act.js`: run through `browser_run_code_unsafe` (older MCPs: `browser_run_code`)
  with `filename` = absolute path. That sandbox has no fs/require, so input goes through instagram.com localStorage
  (`reelReactor.input`, `reelReactor.act`), set with `browser_evaluate` first.
  - collect replays the page's own GraphQL (`PolarisDirectInboxQuery`: a thread is checked if its `last_activity_timestamp_ms` > `state.lastSeen[friend]`, not by Instagram's unread flag, so opening a chat manually doesn't hide reels; else early exit; `IGDThreadDetailQuery`
    for messages, reactions and reel `target_url`) plus REST `/api/v1/media/<pk>/info|comments`. The old
    `/api/v1/direct_v2/*` REST endpoints return 404 on web.
  - act matches a bubble by its preview image file name, scrolls the message list element itself (it's virtualized),
    scopes React/Reply to the ancestor row that holds exactly one `[role=article]`, and verifies through the thread data
    (`wrong_message` if any other message changed). `probe: true` (dry run) finds everything but clicks nothing.
- `.mcp.json` + `scripts/playwright-mcp.mjs`: bundled Playwright MCP. Flags: persistent `--user-data-dir`
  (`~/.reel-reactor/playwright-profile`), `--output-dir ~/.reel-reactor/output` (no `.playwright-mcp/` in the session folder),
  `--allow-unrestricted-file-access` (MCP roots are only the session cwd; without it, loading the scripts from the plugin
  folder fails with "File access denied"), `--codegen none` (tool results don't echo the script). Optional `config.browser`.
  Tools appear as `mcp__plugin_reel-reactor_playwright__*`.
- `config/reel-reactor.example.json`: defaults (new installs are **live**: `dryRun: false`); rr.mjs creates the config from it.
- `scripts/run-once.ps1`, `scripts/schedule-windows.ps1`: CLI-only scheduling on Windows (Task Scheduler `ReelReactor-HHMM`).
- Primary user path is the Claude desktop app: `/plugin marketplace add atinder-harika/dm-reaction-skill` → install →
  new session → `/reel-reactor:setup` → `/reel-reactor:react`; the scheduled task comes from setup / `/reel-reactor:schedule`.

## Runtime files (outside the repo)
`~/.reel-reactor/`: `config.json`, `state.json` (`lastRun`, `processedReelIds` capped at 500, `recheckFriends`, `lastSeen` {friend: last activity ms}; no time cutoff),
`playwright-profile/` (the persistent logged-in browser profile), `output/` (MCP snapshots/logs), `run.log`.

## Scope
- Emoji reactions (~80% of reels, plus the sticker share while stickers are off), ~10% left alone,
  1 reply **to the friend in the DM thread** per run (not a comment on the reel). `dryRun` defaults to false.
- Not built yet: stickers (`stickersEnabled`, `stickers` are reserved in the config).

## Guardrails (keep them in any edit)
Only whitelisted threads. Never enter credentials. Stop on login, checkpoint or CAPTCHA pages. No follows, likes or reel comments;
the only DM sent is the one reply per run in a whitelisted thread. Never click React/Reply by position. Every reaction is verified.
Skip a reel rather than guess at the UI. Replies: ≤15 words, no mentions, links or hashtags, nothing mean or about looks.

## Releasing changes (do this automatically, every time)
Installed copies are cached by `version` (`~/.claude/plugins/cache/reel-reactor-marketplace/reel-reactor/<version>`),
so a change that keeps the same version never reaches users, even after `/plugin marketplace update`. Claude Code doesn't
read GitHub Releases or tags for this; only `version` in `plugin.json` on the default branch.
- Any change to what ships in the plugin (`skills/`, `scripts/`, `.mcp.json`, `config/`, `.claude-plugin/`) must bump
  `version` in `.claude-plugin/plugin.json` **in the same branch/PR**, without being asked. Docs-only changes
  (`README.md`, `CLAUDE.md`) don't need a bump.
- Semver: patch (`0.3.0` → `0.3.1`) for fixes such as selectors, queries or wording; minor (`0.3.x` → `0.4.0`) for new
  behaviour, commands or config keys; major only for breaking config/state changes.
- One bump per PR: if the branch already bumped past `main`'s version, don't bump again.
- New or renamed config keys need a migration step in `rr.mjs` (bump `CONFIG_VERSION`). If the change alters what gets sent,
  have the migration turn `dryRun` on with `dryRunReason: "upgrade"` so the first run after the update is a rehearsal.
- Keep the `description` in `plugin.json` true to current behaviour.
- In the PR description, tell the user how to pick it up: with auto-update on (`/plugin` → Marketplaces → Enable auto-update)
  it arrives by itself, then `/reload-plugins`; otherwise `/plugin marketplace update reel-reactor-marketplace`, then
  `/plugin` → Installed → Update now (or uninstall/reinstall), then a new session and `/reel-reactor:setup`.

## Gotchas
- `npx` doesn't spawn directly on Windows, which is why the bundled server goes through the `playwright-mcp.mjs` launcher (shell spawn).
- Plugin MCP servers and skills only load at session start, so after installing or updating, start a new session.
- Instagram's DOM and queries change often. Selector and query fixes go in `scripts/collect.js` / `scripts/act.js`
  (kept short on purpose). Behaviour and judgment changes go in `skills/react/SKILL.md`. Test act.js changes with `probe: true` first.
- Emoji picker search is picky: 💀 → "death", 🔥 → "flame" (the `SEARCH` map in act.js).
- The desktop scheduled-task tool has no model option; the user picks Sonnet/Haiku on the task in the app.
- To test the MCP launcher without touching the real login, set `REEL_REACTOR_HOME` to a temp dir (separate profile).
