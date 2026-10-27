---
name: friends
description: Manage Reel Reactor's whitelist of friends whose DM'd reels get reactions. list, add or remove Instagram usernames.
argument-hint: "[list|add|remove] <username...>"
disable-model-invocation: true
---

# /reel-reactor:friends

The plugin root is two levels up from this skill's base directory. Run exactly:

```
node "<plugin root>/scripts/rr.mjs" friends $ARGUMENTS
```

The script strips `@`, lowercases, dedupes and validates usernames. On `remove` it also drops the
friend from `recheckFriends` in the state file.

- Show the command's output to the user as is. Add nothing else unless it failed.
- If it exits with an error, show the error line and the usage: `/reel-reactor:friends [list|add|remove] <username...>`.
- If it says there's no config, tell the user to run `/reel-reactor:setup` first.
- Only friends on this list are ever read or reacted to.
