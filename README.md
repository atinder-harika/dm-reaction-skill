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
OS scheduler (9am / 12pm / 5pm)
   └─▶ claude -p "run reel reactor"
         └─▶ skill: reel-reactor:react
               └─▶ Playwright MCP ─▶ instagram.com/direct
                     ├─ new reels from whitelisted friends only
                     ├─ read top comments ─▶ mood ─▶ emoji   (~80-90% of reels)
                     ├─ leave a few alone                   (~10%, looks human)
                     └─ standout reel ─▶ 1 short funny comment
```

The whole behaviour lives in a plain-English [`SKILL.md`](skills/react/SKILL.md). There's no bot
code; Claude drives the browser.

## Requirements

- [Claude Code](https://docs.claude.com/en/docs/claude-code)
- Node.js 18+ (for the Playwright MCP)
- A throwaway Instagram account

## Install

```bash
git clone https://github.com/<you>/dm-reaction-skill.git
```

Then, inside Claude Code:

```
/plugin marketplace add ./dm-reaction-skill
/plugin install reel-reactor@reel-reactor-marketplace
```

Or try it without installing: `claude --plugin-dir ./dm-reaction-skill`.

## Setup

In Claude Code, say **"set up reel reactor"** (or run `/reel-reactor:setup`). It will:

1. check Node and the **Playwright MCP**, and give you the exact install command if it's missing:
   ```bash
   # macOS / Linux
   claude mcp add playwright --scope user -- npx @playwright/mcp@latest --user-data-dir ~/.reel-reactor/playwright-profile
   ```
   ```powershell
   # Windows
   claude mcp add playwright --scope user -- cmd /c npx @playwright/mcp@latest --user-data-dir "$env:USERPROFILE\.reel-reactor\playwright-profile"
   ```
2. create `~/.reel-reactor/config.json` and ask which friends to whitelist
3. open Instagram so **you** can log in by hand (Claude never handles your password; the
   persistent browser profile keeps you logged in)
4. offer to schedule it

## Run

Say **"run reel reactor"** or `/reel-reactor:react`.

The first run is a **dry run** (`"dryRun": true`): it reads everything and prints what it *would* do.
When the table looks right, set `"dryRun": false`.

Example output:

| friend | reel | mood | action |
|---|---|---|---|
| sam | C9xYz… | funny | 😂 |
| sam | C9aBc… | hype | none (roll 93) |
| alex | C8qRs… | wholesome | 😍 + comment: "the dog's face at the end lmao" |

## Config: `~/.reel-reactor/config.json`

| key | default | what it does |
|---|---|---|
| `friends` | `[]` | Instagram usernames whose DMs get processed. Nobody else is touched. |
| `schedule` | `["09:00","12:00","17:00"]` | Daily run times, used by the scheduler script |
| `ratios` | `{emoji: .8, sticker: .1, none: .1}` | Chance of each action per reel |
| `stickersEnabled` | `false` | Stickers are a v2 feature; while off, the sticker share becomes emoji |
| `stickers` | `[]` | Reserved for v2 |
| `defaultEmoji` | `😂` | Used when a reel has no comments |
| `emojiPalette` | 8 emojis | Emojis Claude may pick from |
| `commentsPerRun` | `1` | Funny comments per run |
| `maxReelsPerRun` | `15` | Safety cap |
| `dryRun` | `true` | Read only, no clicks |

Run state (`lastRun`, processed reel IDs) is kept in `~/.reel-reactor/state.json`, so a reel is
never reacted to twice.

## Scheduling

**Windows** (Task Scheduler):
```powershell
powershell -ExecutionPolicy Bypass -File scripts\schedule-windows.ps1          # create tasks
powershell -ExecutionPolicy Bypass -File scripts\schedule-windows.ps1 -Remove  # delete them
```
Logs go to `~/.reel-reactor/run.log`.

**macOS / Linux** (cron), one line per time:
```
0 9 * * * cd ~ && claude --plugin-dir "/path/to/dm-reaction-skill" -p "Use the reel-reactor:react skill to run Reel Reactor now." --allowedTools "mcp__playwright,Read,Write,Edit,Bash(node -e:*)" >> ~/.reel-reactor/run.log 2>&1
```

Scheduled runs are headless Claude, so `--allowedTools` pre-approves only the Playwright browser,
file read/write for the config and state, and `node -e` for the dice rolls.
Your computer has to be awake, and a browser window pops up during each run.

## Roadmap

- [ ] Stickers from a user-chosen list (~10% of reels)
- [ ] Per-friend emoji preferences
- [ ] Headless mode after first login

## License

MIT
