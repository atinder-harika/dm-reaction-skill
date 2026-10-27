---
name: schedule
description: Show or change when Reel Reactor runs (2 to 4 times a day), pause or resume it, and keep the Claude app's scheduled task in sync.
argument-hint: "[HH:MM ...|off|on]"
disable-model-invocation: true
---

# /reel-reactor:schedule

## 1. Update the config
The plugin root is two levels up from this skill's base directory. Run exactly:

```
node "<plugin root>/scripts/rr.mjs" schedule $ARGUMENTS
```

- If it exits with an error, show the error and the usage (`/reel-reactor:schedule 09:00 12:00 17:00`,
  `/reel-reactor:schedule off`, `/reel-reactor:schedule on`) and stop.
- Otherwise it prints the schedule, the next run, and a last line `TASK_SPEC {json}`. Don't show
  the TASK_SPEC line to the user; use it in step 2.

## 2. Sync the Claude app's scheduled task
`TASK_SPEC` is `{ enabled, tasks: [{ taskId, title, description, cronExpression, prompt }] }`.
Usually there's one task; times with different minutes need one task each.

If the scheduled-task tools are available (`list_scheduled_tasks`, `create_scheduled_task`,
`update_scheduled_task`):
1. `list_scheduled_tasks`. Ours are the tasks whose `taskId` starts with `reel-reactor`, or whose
   prompt (read its `path`) starts with `/reel-reactor:react`.
2. For each task in the spec: if a task with that `taskId` exists, `update_scheduled_task` with its
   `cronExpression`, `prompt`, `description`, `title` and `enabled`. Otherwise `create_scheduled_task`
   with the same fields (and `notifyOnCompletion: false`), then, if `enabled` is false, update it to
   `enabled: false`. **Never create a second task when one already exists. Update it.**
3. Any other task of ours that isn't in the spec (left over from an older schedule): update it to
   `enabled: false`, and tell the user they can delete it under **Code → Scheduled**.
4. Use the spec's `prompt` exactly. It only says to run `/reel-reactor:react` with its guardrails, so
   it never goes stale when the plugin updates.

If those tools aren't available (terminal Claude Code), tell the user the config is saved and how to
schedule it: on Windows, `powershell -ExecutionPolicy Bypass -File "<plugin root>\scripts\schedule-windows.ps1"`;
on macOS/Linux, crontab lines like
`0 9 * * * cd ~ && claude -p "/reel-reactor:react" --model sonnet --allowedTools "mcp__plugin_reel-reactor_playwright__*" Read Write Edit "Bash(node:*)"`.

## 3. Report
Print 2 to 4 lines: the times (or "paused"), the next run, and which task was created or updated.
The first time you create the task, add one line: *"Scheduled runs use the app's default model. To
use a cheaper one, open Code → Scheduled → Reel Reactor and pick Sonnet or Haiku if a model option
is shown. The scripts do the heavy lifting."* Remind them the app must be open and the computer awake.
