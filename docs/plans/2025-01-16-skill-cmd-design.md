# Design: /agent-reverse Skill Command

Phase 3 feature - skill file + CLI for user-facing entry point.

## Decisions

- Both skill file AND CLI script
- Skill for Claude Code UX, CLI for automation/portability

## Skill File

**Location:** `skills/agent-reverse.md`

**Commands:**
- `/agent-reverse analyze <url>` - Analyze repo capabilities
- `/agent-reverse install <id>` - Install a capability
- `/agent-reverse sync` - Reinstall all from manifest
- `/agent-reverse audit` - Check for bloat/duplicates

**Behavior:** Instructs Claude to call MCP tools and present results.

## CLI Script

**Location:** `src/cli.ts`

**Usage:**
```bash
npx agent-reverse analyze <url>
npx agent-reverse install <id>
npx agent-reverse sync
npx agent-reverse audit
```

**Flags:**
- `--json` - Output JSON instead of human-readable
- `--workspace <path>` - Override workspace root

## Files to Create

| File | Lines | Purpose |
|------|-------|---------|
| `skills/agent-reverse.md` | ~100 | Claude Code skill |
| `src/cli.ts` | ~150 | CLI entry point |

## package.json Changes

```json
{
  "bin": {
    "agent-reverse": "./dist/cli.js"
  }
}
```

## Command → Function Mapping

| Command | Functions |
|---------|-----------|
| `analyze <url>` | `fetchRepo()` + `analyzeRepo()` |
| `install <id>` | `installCapability()` |
| `sync` | `manifestSync()` |
| `audit` | `manifestAudit()` (stub) |
