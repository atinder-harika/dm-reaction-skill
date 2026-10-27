---
name: dry-run
description: Turn Reel Reactor's dry run on or off, or show whether it's on. In dry run, runs read and probe Instagram but click and send nothing.
argument-hint: "[on|off]"
disable-model-invocation: true
---

# /reel-reactor:dry-run

The plugin root is two levels up from this skill's base directory. Run exactly:

```
node "<plugin root>/scripts/rr.mjs" dry-run $ARGUMENTS
```

- Show the command's output to the user as is (it's already short). Add nothing else unless it failed.
- If it exits with an error, show the error line and the usage: `/reel-reactor:dry-run on|off`.
- If it says there's no config, tell the user to run `/reel-reactor:setup` first.
