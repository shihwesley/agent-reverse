# Phase 7: Local Introspection, Security Scanning, Changelog Awareness

**Date:** 2026-02-11
**Version target:** 2.0.0
**Status:** Design approved

## Overview

Three features that shift agent-reverse from "GitHub extraction tool" to "full local agent infrastructure manager":

- **7A — Local Introspection Engine**: scan and auto-optimize Claude Code settings, skills, hooks, MCP servers, and binary state
- **7B — Security Scanner**: tiered security gate on capability installs (pattern-based, not LLM-based)
- **7C — Changelog Awareness**: detect Claude Code version updates on session start, parse changelogs, auto-apply safe migrations

## 7A: Local Introspection Engine

### New MCP Tools

**`local_scan`** — Builds a typed `LocalState` snapshot of the entire Claude Code environment.

Scanned locations:

```
~/.claude/
├── settings.json          → permissions, hooks, model preferences
├── keybindings.json       → custom key bindings
├── skills/                → skill inventory (name, frontmatter, size, mtime)
├── commands/              → slash commands, user-invocable flags
├── hooks/                 → hook scripts, trigger events
├── agents/                → custom agent definitions
├── docs/                  → cached documentation
└── mcp_servers.json       → registered MCP servers, transport types

Per-project overrides:
├── [project]/.claude/settings.json
├── [project]/.claude/CLAUDE.md
├── [project]/.claude/skills/
└── [project]/.mcp.json

Binary:
├── claude --version       → version string
├── npm list -g            → installed package metadata
└── Feature flag extraction from package internals
```

**Output:** Returns a ~200 token summary with counts and change flags. Full `LocalState` stays on disk only — never round-tripped through LLM context.

### Caching Strategy (Efficiency)

State is persisted to `~/.claude/agent-reverse-local-state.json`:

```json
{
  "version": "1.0",
  "scannedAt": "ISO timestamp",
  "claudeCodeVersion": "2.1.39",
  "fileHashes": {
    "~/.claude/settings.json": "sha256:abc...",
    "~/.claude/skills/brainstorming.md": "sha256:def..."
  },
  "state": { /* full LocalState */ }
}
```

On subsequent calls:

1. **Quick stat pass** — `stat()` each known file for mtime + size. If nothing changed → return cached state. Cost: ~0 tokens, milliseconds of fs calls.
2. **Targeted rescan** — re-parse only files with changed mtime/size. Merge diffs into cache. Rehash changed files.
3. **Binary check** — `claude --version` vs cached version. One shell call, one string compare. Full binary inspection only on version change.

**`local_optimize`** — Reads `LocalState` from disk and runs optimization rules:

| Rule | Action |
|---|---|
| Dead skill detection | Skill installed but never referenced in CLAUDE.md, hooks, or settings |
| Deprecated setting migration | Rename old config keys to current equivalents |
| Missing hook suggestions | Recommend hooks when patterns suggest benefit |
| MCP server health check | Registered but unreachable servers |
| Duplicate capability detection | Same skill in both global and project scope |

Behavior:
- Creates backup via `backup_create` before any mutation
- Auto-applies safe fixes
- Returns report of changes made + items needing manual approval

## 7B: Security Scanner

### Integration Point

Scans capability source files **before** `install_capability` writes anything:

```
repo_fetch → repo_analyze → security_scan → [gate] → install_capability
```

No standalone scan tool. Only fires as part of the install pipeline.

### Pattern Categories

| Category | Severity | Action | Detection patterns |
|---|---|---|---|
| Remote execution | CRITICAL | Hard block | `exec()`, `spawn()`, `fetch()` to unknown hosts, `eval()`, dynamic `require()`, `Function()` constructor |
| Data exfiltration | CRITICAL | Hard block | Outbound HTTP with local file content, base64 payloads in URLs, reads from `~/.claude/` combined with network calls |
| Secret access | MEDIUM | Warn + confirm | Reads from `~/.ssh/`, `~/.aws/`, env var access for `*_KEY`, `*_TOKEN`, `*_SECRET` patterns |
| Persistence | MEDIUM | Warn + confirm | Writes to crontab, launchd plists, shell profiles, systemd units |
| Destructive ops | LOW | Info only | `rm -rf`, `DROP TABLE`, `git push --force`, `reset --hard` |
| Obfuscation | LOW | Info only | Base64/hex strings > 50 chars, `String.fromCharCode` chains, hex-only variable names |

### Enforcement Tiers

- **CRITICAL** → block install, show full report. User must pass `--force-install` to override.
- **MEDIUM** → show findings, require explicit confirmation to proceed.
- **LOW** → include in report, proceed without blocking.

### Implementation

Pattern-based scanning using existing tree-sitter infrastructure from `parsers/mcp.ts`. Regex pass over source files — no LLM token cost.

Report format:

```
Security Scan: my-cool-skill
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Risk Score: 3/10 (LOW)

[MEDIUM] Secret access — line 42 of skill.md
  Pattern: reads process.env.ANTHROPIC_API_KEY
  Context: "const key = process.env.ANTHROPIC_API_KEY"

[LOW] Destructive ops — line 89 of skill.md
  Pattern: git reset --hard
  Context: "Run `git reset --hard HEAD~1` to undo"

Verdict: 1 finding requires confirmation. Proceed? [Y/n]
```

### New Type: `SecurityReport`

```typescript
interface SecurityFinding {
  category: 'remote_execution' | 'data_exfiltration' | 'secret_access' | 'persistence' | 'destructive_ops' | 'obfuscation';
  severity: 'critical' | 'medium' | 'low';
  line: number;
  file: string;
  pattern: string;
  context: string;
}

interface SecurityReport {
  capabilityId: string;
  riskScore: number;        // 0-10
  findings: SecurityFinding[];
  verdict: 'blocked' | 'needs_confirmation' | 'clear';
  scannedAt: string;
}
```

## 7C: Changelog Awareness

### Session Start Hook

New hook in SessionStart that runs `changelog_check`:

```
SessionStart hook
    │
    ├─ claude --version → current version
    ├─ Read cached version from agent-reverse-local-state.json
    │
    ├─ Same version? → done (zero cost)
    │
    └─ Version changed?
        ├─ npm view @anthropic-ai/claude-code versions --json
        ├─ For each new version since last known:
        │   └─ gh api /repos/anthropics/claude-code/releases/tags/v{version}
        │       → extract release notes
        ├─ Parse into categories:
        │   ├─ new_features[]
        │   ├─ breaking_changes[]
        │   ├─ deprecations[]
        │   ├─ bug_fixes[]
        │   └─ config_changes[]
        └─ Cache in ~/.claude/agent-reverse-changelog-cache.json
```

### Migration Rules

`migration-rules.json` maps changelog patterns to local actions:

```json
{
  "rules": [
    {
      "pattern": "deprecated.*allowedTools",
      "action": "rename_setting",
      "from": "allowedTools",
      "to": "permissions.allow",
      "severity": "safe",
      "since": "2.1.35"
    },
    {
      "pattern": "new.*hook.*type",
      "action": "suggest_hook",
      "severity": "breaking",
      "description": "New hook type available — review existing hooks for migration"
    }
  ]
}
```

**Two rule types:**

- **Static rules** — shipped with agent-reverse. Hand-written for known Claude Code changes.
- **LLM-parsed rules** — when a changelog entry doesn't match static rules, a quick LLM call classifies it as safe/breaking/info and extracts config impact. This is the only place tokens are spent, and only for genuinely new entries.

### Auto-Apply Logic

```
For each detected change:
  ├─ severity: "safe"     → auto-apply, log to report
  ├─ severity: "breaking" → add to pending_migrations, present for approval
  └─ severity: "info"     → log only, mention in session summary
```

Backup created before any auto-apply via existing `backup_create`.

### Session Output

Kept brief for token efficiency:

```
[AgentReverse] Claude Code updated: 2.1.39 → 2.1.40
  ✓ Auto-applied: renamed 'allowedTools' → 'permissions.allow'
  ⚠ Needs review: new 'maxTokens' setting (default changed)
  ℹ New: /compact command added
```

No version change = zero output, zero token cost.

### New MCP Tool: `changelog_check`

Exposed as MCP tool so it can also be called on-demand (not just session start).

## New Files

```
src/tools/
├── local.ts           # local_scan, local_optimize
├── security.ts        # security_scan (integrated into install pipeline)
└── changelog.ts       # changelog_check

src/data/
├── security-patterns.json    # pattern definitions for 6 categories
└── migration-rules.json      # changelog → action mappings

tests/unit/
├── local.test.ts
├── security.test.ts
└── changelog.test.ts
```

## Modified Files

```
src/tools/install.ts     # Wire security_scan gate before install
src/server.ts            # Register 4 new tools
src/types.ts             # LocalState, SecurityReport, ChangelogEntry types
src/cli.ts               # New CLI commands: scan, changelog
skills/agent-reverse.md  # Document new commands
```

## Implementation Order

1. **7B Security Scanner first** — lowest risk, isolated, gates existing flow
2. **7A Local Introspection** — builds on existing manifest/audit infrastructure
3. **7C Changelog Awareness** — depends on local_scan cache format from 7A

## Version

This is a major feature set. Target **v2.0.0** release.
