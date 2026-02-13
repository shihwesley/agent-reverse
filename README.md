# AgentReverse

[![npm](https://img.shields.io/npm/v/@shihwesley/agent-reverse)](https://www.npmjs.com/package/@shihwesley/agent-reverse)
[![MCP](https://img.shields.io/badge/MCP-Server-blue.svg)](https://modelcontextprotocol.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Extract tools, skills, and plugins from any source — GitHub repos, local configs, articles — and install only what you need. No cloning entire repositories for one function.

```
> /agent-reverse analyze https://github.com/anthropics/claude-code-plugins

Scanning repo... found 12 capabilities:

  SKILLS (5)
    code-review        Review PRs for bugs, security, performance     [/command]
    test-runner        Run and report test suites                      [/command]
    feature-dev        Guided feature development                     [/command]
    explanatory-style  Educational output mode                        [agent-only]
    learning-style     Quiz-based learning mode                       [agent-only]

  MCP SERVERS (2)
    typescript-lsp     TypeScript language intelligence
    pyright-lsp        Python type checking

  Security scan: all clear (0 critical, 0 medium)

  Which capabilities would you like to install?
```

## Table of Contents

- [Features](#features)
- [Install](#install)
- [Quick Start](#quick-start)
- [Commands](#commands)
- [Security Scanning](#security-scanning)
- [Agent Portability](#agent-portability)
- [Backup and Restore](#backup-and-restore)
- [MCP Tools Reference](#mcp-tools-reference)
- [Documentation](#documentation)
- [Contributing](#contributing)

## Features

- **Analyze anything** — GitHub repos, local files, Cursor configs, web articles, your own Claude Code setup
- **Security scanning** — 6-category pattern matching on every install (remote exec, data exfil, secret access, persistence, destructive ops, obfuscation)
- **Manifest tracking** — `agent-reverse.json` pins every installed capability to a source and commit, like package-lock.json for skills
- **Cross-agent restore** — back up from Claude Code, restore into Cursor or Antigravity (and vice versa)
- **Subagent delegation** — heavy operations (repo cloning, AST parsing, manifest diffing) run in an isolated `agent-reverse-engine` subagent
- **Local introspection** — `analyze local` inventories your environment, finds dead skills, deprecated settings, unreachable MCP servers
- **Changelog awareness** — detects Claude Code version bumps, auto-applies safe migrations, flags breaking changes

## Install

### As a Claude Code plugin (recommended)

```bash
/plugin marketplace add shihwesley/shihwesley-plugins
/plugin install agent-reverse@shihwesley-plugins
```

This installs the MCP server, skills, agents, and hooks automatically.

### Via npx (standalone)

```bash
# Add MCP server
claude mcp add agent-reverse -- npx -y @shihwesley/agent-reverse agent-reverse-server

# Install skills and agents
npx -y @shihwesley/agent-reverse setup
```

Restart Claude Code after setup.

<details>
<summary>Global install or from source</summary>

**Global install:**

```bash
npm install -g @shihwesley/agent-reverse
claude mcp add agent-reverse -- agent-reverse-server
agent-reverse setup
```

**From source:**

```bash
git clone https://github.com/shihwesley/agent-reverse.git
cd agent-reverse
npm install && npm run build
claude mcp add agent-reverse -- node dist/server.js
node dist/cli.js setup
```

</details>

**Requirements:** Node.js >= 20.0.0

## Quick Start

Analyze a repo and install one capability:

```bash
# 1. Point at any source
/agent-reverse analyze https://github.com/cool-user/search-plugin

# 2. Install what you need
/agent-reverse install search-lite

# 3. Check your setup
/agent-reverse audit
```

Health-check your local environment:

```bash
/agent-reverse analyze local
```

Returns: installed skills count, dead skills, deprecated settings, MCP server health, and optimization suggestions.

## Commands

| Command | What it does |
|---------|-------------|
| `/agent-reverse analyze <source>` | Analyze a repo, file, local env, or article URL for extractable capabilities |
| `/agent-reverse install <id>` | Install a capability with security scanning |
| `/agent-reverse sync` | Reinstall all manifest capabilities (new machine setup) |
| `/agent-reverse audit` | Find bloat, duplicates, dead skills, deprecated configs |
| `/agent-reverse check-updates` | Check for capability updates and Claude Code version changes |
| `/agent-reverse backup [--gist]` | Export setup to file, Gist, or GitHub repo |
| `/agent-reverse restore <source>` | Restore from backup, optionally to a different agent platform |

Source types for `analyze`: GitHub URL, local file path, `local` (your environment), article URL.

## Security Scanning

Every install runs 6 checks before writing files:

| Category | Severity | Action |
|----------|----------|--------|
| Remote execution | CRITICAL | Blocked |
| Data exfiltration | CRITICAL | Blocked |
| Secret access | MEDIUM | Warn, ask to confirm |
| Persistence | MEDIUM | Warn, ask to confirm |
| Destructive operations | LOW | Reported |
| Obfuscation | LOW | Reported |

Critical findings block the install. Use `--force` to override after reviewing the code.

## Agent Portability

| Agent | Config path | Status |
|-------|------------|--------|
| Claude Code | `.claude/skills/` | Supported |
| Cursor | `.cursor/rules/` | Supported |
| Antigravity | `skills/` | Supported |

Backup from one, restore to another:

```bash
/agent-reverse backup --gist
/agent-reverse restore <gist-url> --target cursor
```

## Backup and Restore

```bash
# Local backup
/agent-reverse backup

# GitHub Gist (private)
/agent-reverse backup --gist

# Restore with merge
/agent-reverse restore backup.json --merge

# Cross-agent dry run
/agent-reverse restore backup.json --target cursor --dry-run
```

What gets backed up: manifest, skills, commands, rules, CLAUDE.md, and caches.

| Flag | Description |
|------|-------------|
| `--gist` | Upload to private GitHub Gist |
| `--gist --gist-public` | Upload to public Gist |
| `--repo owner/name` | Push to a GitHub repo |
| `--target <agent>` | Convert to: `claude-code`, `cursor`, `antigravity` |
| `--merge` | Merge with existing setup instead of replacing |
| `--dry-run` | Preview without writing |

## MCP Tools Reference

30 tools organized by function:

| Family | Tools | Purpose |
|--------|-------|---------|
| `repo_*` | fetch, analyze, cleanup | Clone and analyze GitHub repos |
| `manifest_*` | add, remove, get, list, audit, sync, check_updates | Manage capability manifest |
| `install_capability` | — | Install with security gate |
| `conflict_*` | check, resolve | Detect and resolve skill conflicts |
| `deps_*` | check, resolve | Dependency analysis |
| `observer_*` | log, get_patterns, clear | Workflow pattern observation |
| `suggester_*` | check, add_repo, list_repos | Capability suggestions |
| `web_*` | fetch, interpret | Extract skills from articles |
| `backup_*` | create, restore, list | Backup and restore |
| `security_scan` | — | Pattern-based security analysis |
| `local_*` | scan, optimize | Environment introspection |
| `changelog_check` | — | Version-aware auto-migration |

## Documentation

- [PRD](./docs/PRD.md) — vision and roadmap
- [Tech spec](./docs/spec.md) — architecture and JSON schemas
- [Test cases](./docs/test_case.md) — real-world usage scenarios

## Contributing

PRs for new agent adapters or language parsers welcome. See the [tech spec](./docs/spec.md) for architecture details.

```bash
git clone https://github.com/shihwesley/agent-reverse.git
cd agent-reverse
npm install && npm run build
npm test
```

## License

MIT
