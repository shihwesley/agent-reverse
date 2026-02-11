# CLAUDE.md - AgentReverse

## Project Overview

Reverse engineering engine for agent capabilities. Extracts, analyzes, and installs skills and tools from any source — GitHub repos, local Claude Code settings, installed binaries, articles, or raw configs. Includes security scanning on installs and changelog-aware auto-migration when Claude Code updates.

## What's New in v2.0.0

**Security Scanner (Phase 7B)** — Every `install_capability` call is now gated by `security_scan`. Pattern-based (regex + AST, zero LLM cost), checks 6 categories: remote execution, data exfiltration, secret access, persistence, destructive ops, obfuscation. Tiered enforcement: critical blocks, medium warns, low informs. Override with `forceInstall`.

**Local Introspection (Phase 7A)** — `local_scan` inventories your entire Claude Code environment (skills, commands, hooks, MCP servers, keybindings, binary version). `local_optimize` finds dead skills, deprecated settings, duplicate scopes. Cached with SHA256 file hashes so repeat calls only rescan what changed.

**Changelog Awareness (Phase 7C)** — `changelog_check` compares your Claude Code version against cache. When a version bump is detected, it fetches changelogs from npm + GitHub, matches against static migration rules, and auto-applies safe changes. Breaking changes are presented for approval. Zero cost when version hasn't changed.

**Reframed skill** — agent-reverse is no longer repo-only. `analyze local` health-checks your setup, `analyze <path>` reads local files, `analyze <url>` handles repos and articles. The tool is now a general-purpose reverse engineering engine.

**30 MCP tools** total (up from 26).

## Build Commands

```bash
npm install          # Install deps
npm run build        # Compile TypeScript
npm run dev          # Watch mode
npm run inspect      # MCP inspector
```

## Phase-Based Development

This project uses phased implementation per `docs/BRANCHES.md`. Each phase = isolated worktree.

### Phase Handoff Protocol

**Before starting a new phase:**
1. Commit and push all current work
2. Run `/clear` to reset context
3. Start new session with "session resume workflow"

**Session resume for phases:**
```bash
git log --oneline -10           # Recent commits (what's done)
git branch -a                   # All branches
git worktree list               # Active worktrees
cat docs/BRANCHES.md            # Phase plan
```

This ensures:
- Fresh context for each phase
- No mid-phase context exhaustion
- Clean handoff with full history awareness

### Current Progress

**All phases complete (v0.1.0 MVP):**
- Phase 1: MCP Core (repo_fetch, repo_analyze, manifest CRUD, install_capability)
- Phase 2: Multi-Agent + Sync (Cursor/Antigravity adapters, manifest_sync, check_updates)
- Phase 3: Skills Layer (skill command, CLI, observer, suggester)
- Phase 4: Advanced (conflict resolution, audit, deep-parser, deps)
- Phase 5: Web Synthesis (web_interpret, web_fetch)

**26 MCP tools registered.** See [docs/CODEBASE_MAP.md](docs/CODEBASE_MAP.md) for full architecture.

## Architecture

```
src/
├── server.ts           # MCP server entry
├── cli.ts              # CLI entry
├── types.ts            # Shared types
├── tools/              # MCP tools (12 files, 26 tools)
│   ├── fetch.ts        # repo_fetch, repo_cleanup
│   ├── analyze.ts      # repo_analyze
│   ├── manifest.ts     # manifest_* tools
│   ├── install.ts      # install_capability
│   ├── sync.ts         # manifest_sync, check_updates
│   ├── observer.ts     # observe_event/patterns/clear
│   ├── suggester.ts    # suggest_capabilities
│   ├── audit.ts        # manifest_audit
│   ├── conflict.ts     # conflict_check/resolve
│   ├── deps.ts         # deps_check/resolve
│   ├── web.ts          # web_interpret, web_fetch
│   └── backup.ts       # backup_create/restore/list
├── adapters/           # Target agent installers
│   ├── claude.ts       # .claude/skills/
│   ├── cursor.ts       # .cursor/rules/
│   └── antigravity.ts  # .agent/skills/
├── parsers/
│   ├── skill.ts        # YAML frontmatter
│   ├── readme.ts       # README extraction
│   └── mcp.ts          # Tree-sitter AST parsing
└── data/
    └── default-repos.json
```

## Key Files

- `agent-reverse.json` - Manifest (installed capabilities)
- `workflow-cache.json` - Observer patterns
- `known-repos.json` - User's watched repos
- `docs/BRANCHES.md` - Phase/branch plan
- `docs/spec.md` - Technical spec
- `docs/PRD.md` - Product requirements
