# Design: Multi-Agent Adapters

Phase 2 feature - Cursor and Antigravity installer adapters.

## Decisions

- Cursor: `.cursor/rules/*.mdc` format only (new format, not deprecated `.cursorrules`)
- Antigravity: User chooses `scope: 'project' | 'global'`

## Cursor Adapter

**Output:** `.cursor/rules/{capabilityId}.mdc`

**MDC Format:**
```markdown
---
description: Short description for rule activation
globs: ["**/*.ts"]  # Optional
alwaysApply: false
---

# Instructions
Content here...
```

**Mapping:**
| ParsedSkill | MDC |
|-------------|-----|
| `name` | filename |
| `description` | `description` |
| `globs` | `globs` |
| `content` | body |

## Antigravity Adapter

**Output:**
- Project: `{workspaceRoot}/.agent/skills/{capabilityId}/SKILL.md`
- Global: `~/.gemini/antigravity/skills/{capabilityId}/SKILL.md`

**SKILL.md Format:**
```markdown
---
name: capability-name
description: What this skill does
---

# Instructions
Content here...
```

**Mapping:**
| ParsedSkill | SKILL.md |
|-------------|----------|
| `name` | `name` |
| `description` | `description` |
| `content` | body |

Note: Each skill in own subdirectory.

## Integration

**types.ts changes:**
```typescript
interface InstallOptions {
  // existing...
  scope?: 'project' | 'global';  // For Antigravity
}
```

**install.ts routing:**
```typescript
switch (targetAgent) {
  case 'claude-code': return installForClaudeCode(...);
  case 'cursor': return installForCursor(...);
  case 'antigravity': return installForAntigravity(...);
}
```

**MCP tool:** Add `scope` param to `install_capability` schema.

## Files to Change

| File | Change |
|------|--------|
| `src/types.ts` | Add `scope` to InstallOptions |
| `src/tools/install.ts` | Route to new adapters, add scope param |
| `src/adapters/cursor.ts` | Full implementation |
| `src/adapters/antigravity.ts` | Full implementation |

## Estimates

- cursor.ts: ~60 lines
- antigravity.ts: ~70 lines
- types/install changes: ~20 lines
