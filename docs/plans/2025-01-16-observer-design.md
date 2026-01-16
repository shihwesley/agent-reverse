# Design: Workflow Observer

Phase 3 feature - track patterns and friction points.

## Decisions

- MCP tool approach: `observer_log` for event capture
- Track all 4 event types: tool_invocation, error, search, manual_action
- 30 day retention with auto-prune

## Cache File Structure

**Location:** `workflow-cache.json`

```json
{
  "version": "1.0",
  "patterns": [
    {
      "id": "uuid",
      "type": "tool_invocation|error|search|manual_action",
      "trigger": "description",
      "frequency": 5,
      "firstSeen": "ISO timestamp",
      "lastSeen": "ISO timestamp",
      "metadata": {}
    }
  ],
  "lastPruned": "ISO timestamp"
}
```

## MCP Tools

**`observer_log`** - Record event
- type: tool_invocation | error | search | manual_action
- trigger: string
- metadata?: object

**`observer_get_patterns`** - Query patterns
- type?: filter by type
- minFrequency?: minimum occurrences

**`observer_clear`** - Reset cache

## Pattern Matching

Same `type` + `trigger` = increment frequency, update lastSeen.

## Files

| File | Change |
|------|--------|
| `src/tools/observer.ts` | New (~120 lines) |
| `src/server.ts` | +2 lines |
