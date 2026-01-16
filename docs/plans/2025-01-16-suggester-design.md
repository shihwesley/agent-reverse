# Design: Proactive Suggester

Phase 3 feature - detect friction and suggest capabilities.

## Decisions

- Curated registry + user additions for known repos
- Trigger threshold: frequency >= 3
- MCP tool approach: `suggester_check` returns suggestions

## Known Repos Registry

**Default:** `src/data/default-repos.json` (bundled)
**User:** `known-repos.json` in workspace (extends defaults)

```json
{
  "version": "1.0",
  "repos": [
    {
      "url": "https://github.com/...",
      "capabilities": ["cap1", "cap2"],
      "keywords": ["keyword1", "keyword2"]
    }
  ]
}
```

## MCP Tools

**`suggester_check`** - Get suggestions
- Returns suggestions with repo, capability, reason, confidence

**`suggester_add_repo`** - Add to watch list
- url, capabilities[], keywords[]

**`suggester_list_repos`** - List known repos

## Suggestion Format

```json
{
  "type": "friction|overlap|keyword_match",
  "message": "Noticed you...",
  "repo": "url",
  "capability": "name",
  "confidence": "high|medium|low"
}
```

## Matching Logic

1. Load patterns (frequency >= 3)
2. Load repos (defaults + user)
3. Match by keyword, error type, or overlap
4. Rank and return

## Files

| File | Change |
|------|--------|
| `src/tools/suggester.ts` | New (~150 lines) |
| `src/data/default-repos.json` | New |
| `src/server.ts` | +2 lines |
