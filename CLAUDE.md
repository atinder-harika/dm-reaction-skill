# Reel Reactor: project notes

A fun, one-off Claude Code **plugin** (for a LinkedIn post and GitHub). It drives Instagram through the
**Playwright MCP** and reacts to reels that whitelisted friends DM the user. It's educational,
probably against Instagram's ToS, and only ever used on a throwaway account.

## Layout
- `.claude-plugin/plugin.json`: plugin manifest (name `reel-reactor`)
- `.claude-plugin/marketplace.json`: single-plugin marketplace so the repo installs with `/plugin`
- `skills/react/SKILL.md`: **the core.** One run: load config/state → inbox → new reels from friends →
  read top comments → mood → emoji (RNG via `node -e`) → one comment on the standout reel → write state → summary table
- `skills/setup/SKILL.md`: checks Node and the Playwright MCP (prints the install command), creates the config, manual login, scheduling
- `config/reel-reactor.example.json`: config template (copied to `~/.reel-reactor/config.json`)
- `scripts/run-once.ps1`: one headless run (`claude -p` with a narrow `--allowedTools`), logs to `~/.reel-reactor/run.log`
- `scripts/schedule-windows.ps1`: registers `ReelReactor-HHMM` Task Scheduler tasks from `config.schedule`; `-Remove` deletes them

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
- On Windows, npx-based MCP servers need `cmd /c npx …` in `claude mcp add`.
- Instagram's DOM changes often. Fixes usually belong in the step wording of `skills/react/SKILL.md`, not in code.
