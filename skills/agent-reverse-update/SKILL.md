---
name: agent-reverse-update
description: Check for AgentReverse skill updates on session start
user-invocable: true
hooks:
  SessionStart:
    - type: command
      command: |
        if [[ -f agent-reverse.json ]]; then
          RESULT=$(npx agent-reverse check-updates --json 2>/dev/null)
          OUTDATED=$(echo "$RESULT" | jq '.outdated | length' 2>/dev/null)
          [[ "$OUTDATED" -gt 0 ]] && echo "[AgentReverse] $OUTDATED update(s) available"
        fi
---

# Agent Reverse Update

Checks for skill updates automatically on session start.

## How It Works

On session start, this skill checks your `agent-reverse.json` manifest against the remote repos to see if any pinned commits have newer versions available.

## Manual Check

To manually check and update:

1. **Check for updates:** Use `manifest_check_updates` MCP tool to see which skills have updates
2. **View outdated:** The tool returns `outdated` array with `id`, `pinnedCommit`, and `latestCommit`
3. **Update all:** Use `manifest_sync` MCP tool to reinstall all skills from latest commits

## Example Usage

```
# Check updates
Use manifest_check_updates tool

# Sync to latest
Use manifest_sync tool
```

## Suppressing Notifications

If you don't want session-start notifications, remove this skill from `.claude/commands/`.
