# Git Worktree Branch Plan

Based on spec.md implementation phases. Each branch = isolated worktree.

## Branch Structure

```
main                      # Stable, project scaffolding
├── phase1/repo-fetch     # repo_fetch tool
├── phase1/repo-analyze   # repo_analyze tool
├── phase1/manifest-core  # manifest_add, manifest_remove
├── phase1/installer      # install_capability (Claude Code only)
├── phase2/multi-agent    # Cursor, Antigravity adapters
├── phase2/sync           # manifest_sync, manifest_check_updates
├── phase3/skill-cmd      # /agent-reverse skill command
├── phase3/observer       # Workflow observer + cache
├── phase3/suggester      # Proactive suggester
├── phase4/conflict       # Conflict resolution + synthesis
├── phase4/audit          # manifest_audit, consolidation
├── phase4/deep-parser    # Tree-sitter AST parsing
└── phase4/deps           # Dependency resolution
```

## Phase 1: MCP Core (MVP)

| Branch | Tool | Description |
|--------|------|-------------|
| `phase1/repo-fetch` | `repo_fetch` | Shallow clone, commit pinning |
| `phase1/repo-analyze` | `repo_analyze` | Parse skills, README, basic structure |
| `phase1/manifest-core` | `manifest_add/remove` | JSON manifest CRUD |
| `phase1/installer` | `install_capability` | Write files to .claude/skills/ |

**Merge order**: repo-fetch -> repo-analyze -> manifest-core -> installer

## Phase 2: Multi-Agent + Sync

| Branch | Tool | Description |
|--------|------|-------------|
| `phase2/multi-agent` | Adapters | Cursor, Antigravity installers |
| `phase2/sync` | `manifest_sync` | Reinstall all from manifest |

## Phase 3: Skills Layer

| Branch | Deliverable | Description |
|--------|-------------|-------------|
| `phase3/skill-cmd` | `/agent-reverse` | Skill entry point |
| `phase3/observer` | Workflow observer | Pattern tracking |
| `phase3/suggester` | Proactive suggester | Friction detection |

## Phase 4: Advanced

| Branch | Tool | Description |
|--------|------|-------------|
| `phase4/conflict` | Synthesis | Merge overlapping capabilities |
| `phase4/audit` | `manifest_audit` | Bloat detection |
| `phase4/deep-parser` | Tree-sitter | AST-level MCP tool extraction |
| `phase4/deps` | Dependencies | Auto-install required capabilities |

## Worktree Commands

```bash
# Create worktree for feature
git worktree add ../agent-reverse-phase1-fetch phase1/repo-fetch -b phase1/repo-fetch

# List worktrees
git worktree list

# Remove after merge
git worktree remove ../agent-reverse-phase1-fetch
```
