# Changelog

All notable changes to agent-reverse are documented here. Follows [Keep a Changelog](https://keepachangelog.com/) and [Semantic Versioning](https://semver.org/).

## [2.1.0] - 2026-02-04

### Added
- Subagent support: heavy operations (analyze, audit, sync) run in a dedicated `agent-reverse-engine` subagent with persistent memory
- Directory-based skills: installs to `.claude/skills/<name>/SKILL.md` instead of flat files
- Subagent auto-setup via `npx agent-reverse setup`

### Changed
- Light commands (install, backup, check-updates) still run inline in the main conversation
- Existing flat files in `skills/` and `commands/` are still read for backward compatibility

## [2.0.0] - 2026-01-26

### Added
- Security scanning: 24 regex patterns across 6 categories (remote execution, data exfiltration, secret access, persistence, destructive ops, obfuscation)
- Local introspection: `local_scan` inventories skills, commands, hooks, MCP servers, keybindings, binary version
- Local optimization: `local_optimize` finds dead skills, deprecated settings, duplicate scopes
- Changelog awareness: `changelog_check` detects Claude Code version bumps and applies migration rules
- SHA256 file hashing for change detection in local state cache
- 4 new MCP tools (security_scan, local_scan, local_optimize, changelog_check)

### Changed
- Every `install_capability` call now runs through security scanner before writing files
- Tool count increased from 26 to 30

## [1.0.0] - 2026-01-15

### Added
- MCP server with 26 tools for capability extraction and management
- Parsers: tree-sitter AST for MCP tools, YAML frontmatter for skills, markdown sections for READMEs
- Adapters: Claude Code (.claude/skills/), Cursor (.cursor/rules/), Antigravity (.agent/skills/)
- Manifest tracking (agent-reverse.json) with sync, audit, conflict resolution, dependency graphs
- Web synthesis: extract skills from articles via cheerio HTML parsing
- Backup/restore to file, GitHub Gist, or GitHub repo with cross-agent path conversion
- Observer + Suggester: workflow pattern tracking with capability recommendations
- CLI with 10 commands and auto-detection of target agent
