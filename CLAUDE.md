# Reel Reactor: project notes

A fun, one-off Claude Code **plugin** (for a LinkedIn post and GitHub). It drives Instagram through the
**Playwright MCP** and reacts to reels that whitelisted friends DM the user. It's educational,
probably against Instagram's ToS, and only ever used on a throwaway account.

## Layout
- `.claude-plugin/plugin.json`: plugin manifest (name `reel-reactor`)
- `.claude-plugin/marketplace.json`: single-plugin marketplace so the repo installs with `/plugin`
- `skills/react/SKILL.md`: **the core.** Fast mode: collect.js → Claude judges mood/emoji (RNG via `node -e`)
  and writes one reply to the friend about the standout reel → act.js → write state → summary table.
  Watch mode: the same run step by step with visible clicks (for videos, and as the fallback).
- `scripts/collect.js` (read-only) and `scripts/act.js`: run through `browser_run_code(_unsafe)` with
  `filename` (absolute path). That sandbox has no fs, so input goes through instagram.com localStorage
  (`reelReactor.input`, `reelReactor.act`), set with `browser_evaluate` first.
  - collect replays the page's own GraphQL (`PolarisDirectInboxQuery` for unread/early exit, `IGDThreadDetailQuery`
    for messages, reactions and reel `target_url`) plus REST `/api/v1/media/<pk>/info|comments`. The old
    `/api/v1/direct_v2/*` REST endpoints return 404 on web.
  - act matches a bubble by its preview image file name, scopes React/Reply to the ancestor row that holds
    exactly one `[role=article]`, and verifies through the thread data (`wrong_message` if any other message changed).
    `probe: true` (dry run) finds everything but clicks nothing.
- `.mcp.json` + `scripts/playwright-mcp.mjs`: bundled Playwright MCP (persistent profile, optional `config.browser`).
  Tools appear as `mcp__plugin_reel-reactor_playwright__*`.
- `skills/setup/SKILL.md`: checks Node and the browser tools, creates the config, manual login, scheduling (desktop Scheduled tasks first)
- `config/reel-reactor.example.json`: config template (copied to `~/.reel-reactor/config.json`)
- `scripts/run-once.ps1`, `scripts/schedule-windows.ps1`: CLI-only scheduling on Windows (Task Scheduler `ReelReactor-HHMM`; `-Remove` deletes them)
- Primary user path is the Claude desktop app: `/plugin marketplace add atinder-harika/dm-reaction-skill` → install → new session → `/reel-reactor:setup` → `/reel-reactor:react` → app Scheduled tasks.

## Runtime files (outside the repo)
`~/.reel-reactor/`: `config.json`, `state.json` (`lastRun`, `processedReelIds` capped at 500, `recheckFriends`; no time cutoff),
`playwright-profile/` (the persistent logged-in browser profile), `run.log`.

## Scope
- v1: emoji reactions (~80% of reels, plus the sticker share while stickers are off), ~10% left alone,
  1 reply **to the friend in the DM thread** per run (not a comment on the reel). `dryRun` defaults to true.
- Stretch (not built): stickers (`stickersEnabled`, `stickers` are reserved in the config).

## Guardrails (keep them in any edit)
Only whitelisted threads. Never enter credentials. Stop on login, checkpoint or CAPTCHA pages. No follows, likes or reel comments;
the only DM sent is the one reply per run in a whitelisted thread. Never click React/Reply by position. Every reaction is verified.
Skip a reel rather than guess at the UI. Replies: ≤15 words, no mentions, links or hashtags, nothing mean.

## Gotchas
- `npx` doesn't spawn directly on Windows, which is why the bundled server goes through the `playwright-mcp.mjs` launcher (shell spawn).
- Plugin MCP servers and skills only load at session start, so after installing, start a new session.
- Instagram's DOM and queries change often. Selector and query fixes go in `scripts/collect.js` / `scripts/act.js`
  (kept short on purpose). Behaviour and judgment changes go in `skills/react/SKILL.md`. Test act.js changes with `probe: true` first.
- Emoji picker search is picky: 💀 → "death", 🔥 → "flame" (the `SEARCH` map in act.js).
