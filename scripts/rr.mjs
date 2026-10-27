#!/usr/bin/env node
// Reel Reactor config helper, used by the slash-command skills so nobody edits config.json by hand.
//   node rr.mjs migrate [--quiet]            create/upgrade ~/.reel-reactor/config.json and state.json
//   node rr.mjs status                        config + state summary (the skill adds login and task info)
//   node rr.mjs dry-run [on|off]              show or set dryRun
//   node rr.mjs friends [list|add|remove] <username...>
//   node rr.mjs schedule [HH:MM ...|off|on]   show or set run times; prints the scheduled-task spec as JSON
//   node rr.mjs task-spec                     the scheduled-task spec only (JSON)
// REEL_REACTOR_HOME overrides ~/.reel-reactor. Exit code 1 = invalid input (message on stderr).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CONFIG_VERSION = 3;
const PLUGIN_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HOME = process.env.REEL_REACTOR_HOME || join(homedir(), ".reel-reactor");
const CONFIG = join(HOME, "config.json");
const STATE = join(HOME, "state.json");
const DEFAULTS = JSON.parse(readFileSync(join(PLUGIN_ROOT, "config", "reel-reactor.example.json"), "utf8"));
// The scheduled task only ever says "run the skill", so it can't go stale when the skill changes.
const TASK_PROMPT = [
  "/reel-reactor:react",
  "",
  "Run the reel-reactor:react skill once, exactly as the skill describes. Follow its guardrails: only whitelisted threads,",
  "never enter credentials, stop on any login, checkpoint or CAPTCHA page. Finish with the skill's summary table.",
].join("\n");

const fail = (msg) => { console.error(msg); process.exit(1); };
const readJson = (p, fallback) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return fallback; } };
const writeJson = (p, v) => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, JSON.stringify(v, null, 2) + "\n"); };
const normUser = (u) => String(u).trim().replace(/^@/, "").toLowerCase();
const validUser = (u) => /^[a-z0-9._]{1,30}$/.test(u);

// Upgrades an old config in place and returns human-readable notes about what changed.
function migrate(cfg) {
  const notes = [];
  let v = cfg.configVersion ?? ("commentsPerRun" in cfg || !("mode" in cfg) ? 1 : 2);
  if (v < 2) {
    // 0.1.x posted a public comment on the reel; 0.2.0+ sends one DM reply to the friend instead.
    if ("commentsPerRun" in cfg) {
      cfg.repliesPerRun = Math.min(1, Number(cfg.commentsPerRun) || 0);
      delete cfg.commentsPerRun;
      notes.push(`renamed commentsPerRun → repliesPerRun (${cfg.repliesPerRun}): the per-run comment is now a DM reply to your friend`);
    }
    if (!("mode" in cfg)) { cfg.mode = "fast"; notes.push('added mode: "fast" (one-call scripts; "watch" = step by step for videos)'); }
    if (!cfg.dryRun) {
      cfg.dryRun = true;
      cfg.dryRunReason = "upgrade";
      notes.push("turned dryRun on for the first run after this upgrade, because what gets sent changed. Check the table, then run /reel-reactor:dry-run off");
    }
    v = 2;
  }
  for (const [k, val] of Object.entries(DEFAULTS)) {
    if (!(k in cfg)) { cfg[k] = val; notes.push(`added ${k}: ${JSON.stringify(val)}`); }
  }
  if (cfg.repliesPerRun > 1) { cfg.repliesPerRun = 1; notes.push("capped repliesPerRun at 1"); }
  const friends = [...new Set((cfg.friends || []).map(normUser).filter(Boolean))];
  if (JSON.stringify(friends) !== JSON.stringify(cfg.friends)) { cfg.friends = friends; notes.push("cleaned up friend usernames (no @, lowercase, no duplicates)"); }
  cfg.configVersion = CONFIG_VERSION;
  return notes;
}

function load({ create = false } = {}) {
  let cfg = readJson(CONFIG, null);
  const notes = [];
  if (!cfg) {
    if (!create) fail(`No config at ${CONFIG}. Run /reel-reactor:setup first.`);
    cfg = { ...DEFAULTS, configVersion: CONFIG_VERSION };
    notes.push(`created ${CONFIG} from the example`);
  } else {
    const before = JSON.stringify(cfg);
    notes.push(...migrate(cfg));
    if (JSON.stringify(cfg) === before) notes.length = 0;
  }
  const state = readJson(STATE, {});
  state.processedReelIds ||= [];
  state.recheckFriends ||= [];
  state.lastRun ??= null;
  return { cfg, state, notes };
}
const save = ({ cfg, state }) => { writeJson(CONFIG, cfg); if (state) writeJson(STATE, state); };

const parseTime = (t) => {
  const m = String(t).trim().match(/^(\d{1,2}):?(\d{2})$/);
  if (!m || +m[1] > 23 || +m[2] > 59) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
};
// Times that share a minute go in one cron task ("0 9,12,17 * * *"); different minutes need one task each.
function cronGroups(times) {
  const byMinute = new Map();
  for (const t of times) { const [h, m] = t.split(":").map(Number); (byMinute.get(m) || byMinute.set(m, []).get(m)).push(h); }
  return [...byMinute].map(([m, hs]) => `${m} ${hs.sort((a, b) => a - b).join(",")} * * *`);
}
function taskSpec(cfg) {
  const crons = cronGroups(cfg.schedule || []);
  return {
    enabled: cfg.scheduleEnabled !== false && crons.length > 0,
    tasks: crons.map((cron, i) => ({
      taskId: i === 0 ? "reel-reactor" : `reel-reactor-${i + 1}`,
      title: "Reel Reactor",
      description: `Run Reel Reactor at ${cfg.schedule.join(", ")}`,
      cronExpression: cron,
      prompt: TASK_PROMPT,
    })),
  };
}
function nextRun(cfg, now = new Date()) {
  if (cfg.scheduleEnabled === false || !cfg.schedule?.length) return null;
  const candidates = [];
  for (const day of [0, 1]) for (const t of cfg.schedule) {
    const [h, m] = t.split(":").map(Number);
    const d = new Date(now); d.setDate(d.getDate() + day); d.setHours(h, m, 0, 0);
    if (d > now) candidates.push(d);
  }
  return candidates.sort((a, b) => a - b)[0] || null;
}
const fmtDate = (d) => d ? d.toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" }) : "—";
const ago = (iso) => {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso)) / 60000);
  return mins < 60 ? `${mins} min ago` : mins < 2880 ? `${Math.round(mins / 60)} h ago` : `${Math.round(mins / 1440)} days ago`;
};
const printNotes = (notes) => { if (notes.length) { console.log("Config updated:"); for (const n of notes) console.log(`  - ${n}`); } };

const [cmd = "status", ...args] = process.argv.slice(2);
switch (cmd) {
  case "migrate": {
    const data = load({ create: true });
    save(data);
    if (!args.includes("--quiet") || data.notes.length) {
      if (data.notes.length) printNotes(data.notes); else console.log(`Config is up to date (version ${CONFIG_VERSION}).`);
    }
    break;
  }
  case "status": {
    const { cfg, state, notes } = load();
    if (notes.length) save({ cfg, state });
    printNotes(notes);
    const rows = [
      ["Last run", state.lastRun ? `${new Date(state.lastRun).toLocaleString()} (${ago(state.lastRun)})` : "never"],
      ["Reels handled", String(state.processedReelIds.length)],
      ["Friends", cfg.friends.length ? cfg.friends.map((f) => "@" + f).join(", ") : "none — add with /reel-reactor:friends add <username>"],
      ["Waiting to re-check", state.recheckFriends.length ? state.recheckFriends.map((f) => "@" + f).join(", ") : "—"],
      ["Dry run", cfg.dryRun ? `on${cfg.dryRunReason === "upgrade" ? " (set by upgrade)" : ""}: reads and probes, sends nothing` : "off: live"],
      ["Mode", cfg.mode],
      ["Schedule", cfg.scheduleEnabled === false ? `paused (${cfg.schedule.join(", ")})` : cfg.schedule.join(", ") || "none"],
      ["Next run (config)", fmtDate(nextRun(cfg))],
    ];
    const w = Math.max(...rows.map((r) => r[0].length));
    for (const [k, v] of rows) console.log(`${k.padEnd(w)}  ${v}`);
    break;
  }
  case "dry-run": {
    const data = load();
    const arg = (args[0] || "").toLowerCase();
    if (arg && !["on", "off"].includes(arg)) fail(`Use: /reel-reactor:dry-run on|off (got "${args[0]}")`);
    if (arg) { data.cfg.dryRun = arg === "on"; delete data.cfg.dryRunReason; save(data); }
    printNotes(data.notes);
    console.log(data.cfg.dryRun ? "Dry run is ON: runs read and probe only, nothing is clicked or sent." : "Dry run is OFF: runs react and reply for real.");
    break;
  }
  case "friends": {
    const data = load();
    const sub = (args[0] || "list").toLowerCase();
    const users = [...new Set(args.slice(1).flatMap((a) => a.split(",")).map(normUser).filter(Boolean))];
    const { cfg, state } = data;
    cfg.friends = [...new Set(cfg.friends.map(normUser))];
    if (sub === "add" || sub === "remove") {
      if (!users.length) fail(`Use: /reel-reactor:friends ${sub} <username...>`);
      const bad = users.filter((u) => !validUser(u));
      if (bad.length) fail(`Not a valid Instagram username: ${bad.join(", ")}`);
      if (sub === "add") {
        const added = users.filter((u) => !cfg.friends.includes(u));
        cfg.friends.push(...added);
        console.log(added.length ? `Added: ${added.map((u) => "@" + u).join(", ")}` : "Nothing new to add.");
      } else {
        const removed = users.filter((u) => cfg.friends.includes(u));
        cfg.friends = cfg.friends.filter((u) => !users.includes(u));
        state.recheckFriends = state.recheckFriends.filter((u) => !users.includes(normUser(u)));
        console.log(removed.length ? `Removed: ${removed.map((u) => "@" + u).join(", ")}` : "None of those were on the list.");
      }
      save(data);
    } else if (sub !== "list") fail("Use: /reel-reactor:friends [list|add|remove] <username...>");
    printNotes(data.notes);
    console.log(cfg.friends.length ? `Whitelisted (${cfg.friends.length}): ${cfg.friends.map((u) => "@" + u).join(", ")}` : "No friends whitelisted yet.");
    break;
  }
  case "schedule": {
    const data = load();
    const { cfg } = data;
    if (args.length) {
      const a0 = args[0].toLowerCase();
      if (a0 === "off" || a0 === "on") cfg.scheduleEnabled = a0 === "on";
      else {
        const times = args.flatMap((a) => a.split(",")).filter(Boolean).map((t) => [t, parseTime(t)]);
        const bad = times.filter(([, p]) => !p).map(([t]) => t);
        if (bad.length) fail(`Not a time (use HH:MM, 24h): ${bad.join(", ")}`);
        const uniq = [...new Set(times.map(([, p]) => p))].sort();
        if (uniq.length < 2 || uniq.length > 4) fail(`Pick 2 to 4 times a day (got ${uniq.length}).`);
        cfg.schedule = uniq;
        cfg.scheduleEnabled = true;
      }
      save(data);
    }
    printNotes(data.notes);
    console.log(cfg.scheduleEnabled === false ? `Schedule: paused (times kept: ${cfg.schedule.join(", ")})` : `Schedule: ${cfg.schedule.join(", ")} daily`);
    console.log(`Next run: ${fmtDate(nextRun(cfg))}`);
    console.log("TASK_SPEC " + JSON.stringify(taskSpec(cfg)));
    break;
  }
  case "task-spec": {
    const { cfg } = load();
    console.log(JSON.stringify(taskSpec(cfg)));
    break;
  }
  default:
    fail(`Unknown command "${cmd}". Commands: migrate, status, dry-run, friends, schedule, task-spec`);
}
