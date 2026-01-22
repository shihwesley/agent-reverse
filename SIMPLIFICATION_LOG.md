# Code Simplification Log

## Session: 2026-01-21

### Summary
- Files analyzed: 17
- Files modified: 1
- Lines saved: ~7

### Changes Made

#### 1. src/cli.ts - Remove dead code from output function
**Lines changed:** 76-84 -> 76-78
**Savings:** ~6 lines

The `output()` function had a `json: boolean` parameter that was always called with `true`. The conditional logic handling `json=false` was dead code.

**Before:**
```typescript
function output(data: unknown, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(data, null, 2));
  } else if (typeof data === 'string') {
    console.log(data);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}
```

**After:**
```typescript
function output(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}
```

Also updated 6 call sites to remove unused second parameter:
- Line 96: `output(analysis, true)` -> `output(analysis)`
- Line 148, 167, 189: `output(result, true)` -> `output(result)`
- Line 215: `output({ capabilities, untracked: [], duplicates: [] }, true)` -> removed arg
- Line 231: `output(capabilities, true)` -> `output(capabilities)`

### Not Changed
- **suggester.ts duplicate types**: Pattern/WorkflowCache defined separately from observer.ts. Intentional - suggester uses subset of fields, avoiding tight coupling.
- **Error message pattern**: `error instanceof Error ? error.message : String(error)` appears 17x. Too small for utility extraction; inline is readable.
- **Frontmatter builders**: claude.ts/cursor.ts have similar YAML builders but handle edge cases differently. Not worth consolidating.

### Notes
- Codebase is well-structured with clear separation of concerns
- MCP tool registrations follow consistent pattern
- Types are properly centralized in types.ts (except workflow-specific types which are file-local)
