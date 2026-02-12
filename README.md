# AgentReverse

[![npm](https://img.shields.io/npm/v/@shihwesley/agent-reverse)](https://www.npmjs.com/package/@shihwesley/agent-reverse)
[![MCP](https://img.shields.io/badge/MCP-Server-blue.svg)](https://modelcontextprotocol.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Extract tools, skills, and plugins from any source — GitHub repos, local configs, articles — and install only what you need. No cloning entire repositories for one function.

## What's new in v2.1.0

**Subagent support.** Heavy operations (`analyze`, `audit`, `sync`) now run in a dedicated `agent-reverse-engine` subagent. Repo cloning, AST parsing, and manifest diffing happen in an isolated context window instead of filling your main conversation. The subagent has persistent memory (`~/.claude/agent-memory/agent-reverse-engine/`), so it learns your repos and preferences across sessions. Light commands (`install`, `backup`, `check-updates`) still run inline. `npx agent-reverse setup` installs the subagent to `.claude/agents/` automatically.

**Directory-based skills.** Skills now install to `.claude/skills/<name>/SKILL.md` instead of flat files, matching the current Claude Code convention. Existing flat files in `skills/` and `commands/` are still read for backward compatibility.

## What's new in v2.0.0

**Security scanning.** Every `install_capability` call now runs through a security scanner before anything touches your config. Pattern-based (regex + AST), checks 6 categories: remote execution, data exfiltration, secret access, persistence, destructive operations, obfuscation. Critical findings block the install. Override with `forceInstall` if you know what you're doing.

**Local introspection.** `local_scan` inventories your entire Claude Code environment — skills, commands, hooks, MCP servers, keybindings, binary version. `local_optimize` finds dead skills, deprecated settings, duplicate scopes. Results are cached with SHA256 file hashes so repeat calls only rescan changed files.

**Changelog awareness.** `changelog_check` compares your Claude Code version against a local cache. When it detects a version bump, it fetches changelogs from npm + GitHub, matches against migration rules, and auto-applies safe changes. Breaking changes require your approval. No cost when the version hasn't changed.

**30 MCP tools** total (up from 26).

## Installation

### Quick start (Claude Code)

```bash
# Add MCP server
claude mcp add agent-reverse -- npx -y @shihwesley/agent-reverse agent-reverse-server

# Install slash commands (run from your project directory)
npx -y @shihwesley/agent-reverse setup
```

Restart Claude Code. You get:
- 30 MCP tools for extraction, analysis, security scanning, and local introspection
- `/agent-reverse` — reverse engineer capabilities from repos, local configs, articles, or your own setup
- `/agent-reverse-update` — check for skill updates and Claude Code version changes

### Upgrading

```bash
# Re-run setup for latest skills (MCP auto-updates via npx)
npx -y @shihwesley/agent-reverse@latest setup
```

### Global install (optional)

```bash
npm install -g @shihwesley/agent-reverse

# Then use without npx:
claude mcp add agent-reverse -- agent-reverse-server
agent-reverse setup
agent-reverse --help
```

### From source

```bash
git clone https://github.com/shihwesley/agent-reverse.git
cd agent-reverse
npm install && npm run build

# MCP server
claude mcp add agent-reverse -- node dist/server.js

# CLI
node dist/cli.js setup
node dist/cli.js --help
```

## How it works

AgentReverse is two things:

1. **MCP server** — fetches repos, parses ASTs, manages the manifest, runs security scans. This is the engine.
2. **Skills layer** — lives inside your agent (Claude Code, Cursor, etc.), watches your workflow, and suggests capabilities when friction is high.

```mermaid
graph TD
    User([User]) --> Agent[Host Agent]
    Agent -->|Invokes| AR[AgentReverse MCP]
    AR -->|Reverse Engineer| Repo[(External Repo)]
    AR -->|Surgical Write| Local[Local Skills/Configs]
    AR -->|Record| Manifest[agent-reverse.json]
```

The manifest (`agent-reverse.json`) tracks every installed capability — source repo, pinned commit, dependencies. Think `package-lock.json` but for agent skills.

## Usage

### Analyze a repo

```
/agent-reverse analyze https://github.com/cool-user/search-plugin
```

Returns a categorized bill of materials: every skill, tool, and prompt in the repo.

### Analyze your local setup

```
/agent-reverse analyze local
```

Scans your Claude Code environment for dead skills, deprecated settings, and optimization opportunities.

### Extract and install

```
/agent-reverse install search-lite --target claude
```

Installs the capability, updates CLAUDE.md, and pins the commit in your manifest.

### Sync across machines

```
/agent-reverse sync
```

Re-installs all capabilities from your manifest into a fresh environment.

## Security scanning

Every install runs through 6 security checks before writing files:

| Category | What it catches |
|----------|----------------|
| Remote execution | Shell spawns, eval, child_process |
| Data exfiltration | Outbound HTTP with file reads, DNS exfil |
| Secret access | Reads of .env, credentials, API keys |
| Persistence | Cron jobs, startup scripts, auto-run hooks |
| Destructive operations | rm -rf, file overwrites, git force-push |
| Obfuscation | Base64 payloads, hex encoding, string construction |

Critical findings block the install. Medium findings warn. Low findings inform. Use `forceInstall` to override if you've reviewed the code.

## Agent portability

Supported targets:

| Agent | Config path | Status |
|-------|------------|--------|
| Claude Code | `.claude/skills/` | Supported |
| Cursor | `.cursor/rules/` | Supported |
| Antigravity | `skills/` | Supported |
| Custom adapters | — | Planned |

## Backup and restore

Export your setup for portability across machines or agent platforms.

### What gets backed up

| Item | Path |
|------|------|
| Manifest | `agent-reverse.json` |
| Skills | `.claude/skills/*.md` |
| Commands | `.claude/commands/*.md` |
| Rules | `.cursor/rules/*.mdc` |
| CLAUDE.md | `CLAUDE.md` |
| Caches | `workflow-cache.json`, `known-repos.json` |

### Create a backup

```bash
# Local file (default: agent-reverse-backup-<date>.json)
agent-reverse backup

# Custom filename
agent-reverse backup --output my-backup.json

# Private GitHub Gist
agent-reverse backup --gist

# Public Gist
agent-reverse backup --gist --gist-public

# GitHub repo
agent-reverse backup --repo myuser/agent-backups
```

### Restore from backup

```bash
# From local file
agent-reverse restore backup.json

# From Gist
agent-reverse restore https://gist.github.com/user/abc123

# From GitHub repo
agent-reverse restore https://github.com/user/backups/blob/main/backups/2026-01-26.json
```

### Cross-agent restore

```bash
# Restore Claude skills to Cursor format
agent-reverse restore backup.json --target cursor

# Dry run
agent-reverse restore backup.json --target cursor --dry-run
```

### Restore flags

| Flag | Description |
|------|-------------|
| `--target <agent>` | Convert to: `claude-code`, `cursor`, `antigravity` |
| `--merge` | Merge with existing setup instead of replacing |
| `--force` | Overwrite existing files |
| `--dry-run` | Preview changes without writing |

## MCP tools reference

| Tool family | Tools | Purpose |
|-------------|-------|---------|
| `repo_*` | `repo_fetch`, `repo_analyze`, `repo_cleanup` | Fetch and analyze GitHub repos |
| `manifest_*` | `manifest_add`, `manifest_remove`, `manifest_get`, `manifest_list`, `manifest_audit`, `manifest_sync`, `manifest_check_updates` | Manage the capability manifest |
| `install_capability` | — | Install with security gate |
| `conflict_*` | `conflict_check`, `conflict_resolve` | Detect and resolve skill conflicts |
| `deps_*` | `deps_check`, `deps_resolve` | Dependency analysis |
| `observer_*` | `observer_log`, `observer_get_patterns`, `observer_clear` | Workflow pattern observation |
| `suggester_*` | `suggester_check`, `suggester_add_repo`, `suggester_list_repos` | Capability suggestions |
| `web_*` | `web_fetch`, `web_interpret` | Extract skills from articles and docs |
| `backup_*` | `backup_create`, `backup_restore`, `backup_list` | Backup and restore |
| `security_scan` | — | Pattern-based security analysis |
| `local_*` | `local_scan`, `local_optimize` | Environment introspection |
| `changelog_check` | — | Version-aware auto-migration |

## Documentation

- [PRD](./docs/PRD.md) — vision and roadmap
- [Tech spec](./docs/spec.md) — architecture and JSON schemas
- [Test cases](./docs/test_case.md) — real-world usage scenarios

## Contributing

PRs for new agent adapters or language parsers are welcome. See the [tech spec](./docs/spec.md) for architecture details.

## License

MIT
