# Design: Sync Tools

Phase 2 feature - manifest_sync and manifest_check_updates tools.

## Decisions

- manifest_sync: Reinstall all (delete existing, reinstall from manifest)
- manifest_check_updates: Use `git ls-remote` for fast HEAD check

## manifest_sync Tool

**Purpose:** Reinstall all capabilities from manifest.

**Flow:**
1. Read `agent-reverse.json` manifest
2. For each capability with `status: 'installed'`:
   - Fetch source repo (repo_fetch)
   - Install to target agent (install_capability)
3. Return summary

**Input:**
```typescript
{
  workspaceRoot?: string;     // Defaults to cwd
  targetAgent?: TargetAgent;  // Override manifest's targetAgent
}
```

**Output:**
```typescript
{
  installed: string[];
  failed: { id: string; error: string }[];
  skipped: string[];  // Superseded
}
```

## manifest_check_updates Tool

**Purpose:** Compare pinned commits vs remote HEAD.

**Flow:**
1. Read manifest
2. For each capability: `git ls-remote <url> HEAD`
3. Compare with pinned commit

**Input:**
```typescript
{
  workspaceRoot?: string;
}
```

**Output:**
```typescript
{
  outdated: {
    id: string;
    source: string;
    pinnedCommit: string;
    latestCommit: string;
  }[];
  upToDate: string[];
  failed: { id: string; error: string }[];
}
```

## Files to Change

| File | Change |
|------|--------|
| `src/tools/sync.ts` | New file (~150 lines) |
| `src/server.ts` | Add import + register call |

## Dependencies

- `repo_fetch` from `./fetch.ts`
- `installCapability` from `./install.ts`
- Manifest reading from `./manifest.ts`
