# Reel Reactor: project notes

A fun, one-off Claude Code **plugin** (for a LinkedIn post and GitHub). It drives Instagram through the
**Playwright MCP** and reacts to reels that whitelisted friends DM the user. It's educational,
probably against Instagram's ToS, and only ever used on a throwaway account.

## Layout
- `.claude-plugin/plugin.json`: plugin manifest (name `reel-reactor`)
- `.claude-plugin/marketplace.json`: single-plugin marketplace so the repo installs with `/plugin`
- `skills/react/SKILL.md`: **the core.** One run: load config/state → inbox → new reels from friends →
  read top comments → mood → emoji (RNG via `node -e`) → one comment on the standout reel → write state → summary table
- `.mcp.json` + `scripts/playwright-mcp.mjs`: bundled Playwright MCP (persistent profile, optional `config.browser`).
  Tools appear as `mcp__plugin_reel-reactor_playwright__*`.
- `skills/setup/SKILL.md`: checks Node and the browser tools, creates the config, manual login, scheduling (desktop Scheduled tasks first)
- `config/reel-reactor.example.json`: config template (copied to `~/.reel-reactor/config.json`)
- `scripts/run-once.ps1`, `scripts/schedule-windows.ps1`: CLI-only scheduling on Windows (Task Scheduler `ReelReactor-HHMM`; `-Remove` deletes them)
- Primary user path is the Claude desktop app: `/plugin marketplace add atinder-harika/dm-reaction-skill` → install → new session → `/reel-reactor:setup` → `/reel-reactor:react` → app Scheduled tasks.

## Runtime files (outside the repo)
`~/.reel-reactor/`: `config.json`, `state.json` (`lastRun`, `processedReelIds`, capped at 500),
`playwright-profile/` (the persistent logged-in browser profile), `run.log`.

## Scope
- v1: emoji reactions (~80% of reels, plus the sticker share while stickers are off), ~10% left alone,
  1 comment per run. `dryRun` defaults to true.
- Stretch (not built): stickers (`stickersEnabled`, `stickers` are reserved in the config).

## Guardrails (keep them in any edit)
Only whitelisted threads. Never enter credentials. Stop on login, checkpoint or CAPTCHA pages. No DMs, follows or likes.
Skip a reel rather than guess at the UI. Comments: ≤15 words, no mentions, links or hashtags, nothing mean.

## Gotchas
- `npx` doesn't spawn directly on Windows, which is why the bundled server goes through the `playwright-mcp.mjs` launcher (shell spawn).
- Plugin MCP servers and skills only load at session start, so after installing, start a new session.
- Instagram's DOM changes often. Fixes usually belong in the step wording of `skills/react/SKILL.md`, not in code.
