# 🧬 AgentReverse

[![npm](https://img.shields.io/npm/v/@shihwesley/agent-reverse)](https://www.npmjs.com/package/@shihwesley/agent-reverse)
[![MCP](https://img.shields.io/badge/MCP-Server-blue.svg)](https://modelcontextprotocol.io/)
[![Protocol](https://img.shields.io/badge/Agent-Portable-green.svg)](#portability)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **"Stop the bloat. Maximize the context. Extract the DNA."**

**AgentReverse** is a surgical integration engine designed to eliminate agent/plugin bloat. Instead of cloning entire repositories just for a single feature, AgentReverse reverse-engineers tools, skills, and plugins to extract only the essential logic—surgically implanting them into your current workflow.

---

## 📦 Installation

### Quick Start (Claude Code)

```bash
# Step 1: Add MCP server
claude mcp add agent-reverse -- npx -y @shihwesley/agent-reverse agent-reverse-server

# Step 2: Install slash commands (run from your project directory)
npx -y @shihwesley/agent-reverse setup
```

Restart Claude Code. You now have:
- **26 MCP tools** for surgical extraction
- **/agent-reverse** - Analyze and install skills from GitHub repos
- **/agent-reverse-update** - Check for skill updates on session start

### Upgrading

```bash
# Re-run setup to get latest skills (MCP auto-updates via npx)
npx -y @shihwesley/agent-reverse@latest setup
```

### Global Install (Optional)

```bash
npm install -g @shihwesley/agent-reverse

# Then use without npx:
claude mcp add agent-reverse -- agent-reverse-server
agent-reverse setup
agent-reverse --help
```

### From Source (Development)

```bash
git clone https://github.com/shihwesley/agent-reverse.git
cd agent-reverse
npm install
npm run build

# Run MCP server locally
claude mcp add agent-reverse -- node dist/server.js

# Run CLI locally
node dist/cli.js setup
node dist/cli.js --help
```

---

## ⚡ The Philosophy: "Every Token Counts"

In the era of AI agents, your **context window is your most valuable resource**.
Typical agent setups suffer from:

- **📦 Bloat**: Installing 100 files for 1 function.
- **📉 Context Shrinkage**: Redundant prompts and redundant code eating your token budget.
- **🧱 Fragmentation**: Skills scattered across GitHub with no unified way to sync them.

**AgentReverse solves this.** It treats agent capabilities like `requirements.txt` for Python—providing a leaner, faster, and smarter workflow.

---

## ✨ Key Features

- **🔬 Surgical Extraction**: Point to any GitHub repo, and AgentReverse isolates the "DNA" (tools, skills, or prompts) you actually need.
- **📑 Agent Requirements Manifest**: A universal `agent-reverse.json` file that tracks your capabilities, source commits, and dependencies.
- **🔄 Zero-Friction Sync**: Move from **Claude Code** to **Cursor** or **Antigravity**? One command restores your entire custom agent setup.
- **🧩 Synthesis Engine**: Detected a better way to do search in a new repo? AgentReverse can merge it with your existing tools to create a "superskill."
- **🕵️ Audit & Slim**: Scan your current messy `skills/` folders. Identify duplicates, find dead weight, and propose a consolidation plan.
- **📖 Research Interpreter**: Give it a blog post or a whitepaper (e.g., *Reasoning with Language Models*). It synthesizes the concept directly into a working agent skill.

---

## 🏗️ How It Works (Hybrid Architecture)

AgentReverse operates as a **Hybrid System**:

1. **MCP Server**: A universal engine that handles the "heavy lifting"—fetching repos, parsing ASTs, and managing the manifest.
2. **Skills Layer**: Proactive UX that lives inside your agent (Claude Code, etc.), observing your workflow and suggesting optimizations when things feel "high friction."

```mermaid
graph TD
    User([User]) --> Agent[Host Agent]
    Agent -->|Invokes| AR[AgentReverse MCP]
    AR -->|Reverse Engineer| Repo[(External Repo)]
    AR -->|Surgical Write| Local[Local Skills/Configs]
    AR -->|Record| Manifest[agent-reverse.json]
```

---

## 🌍 Agent Portability

Supported target systems:

- [x] **Claude Code** (`.claude/skills/`)
- [x] **Antigravity** (`skills/`)
- [x] **Cursor** (`.cursor/rules/`)
- [ ] **Custom Adapters** (Coming soon)

---

## 🚀 Usage Peek

### 🔍 Analyze a Repo

```bash
/agent-reverse analyze https://github.com/cool-user/search-plugin
```

*Result: A categorized "Bill of Materials" of every skill and tool inside.*

### 🧬 Extract & Install

```bash
/agent-reverse install search-lite --target claude
```

*Result: Installs the tool, updates CLAUDE.md, and pins the commit in your manifest.*

### 🔄 Sync Your Life

```bash
/agent-reverse sync
```

*Result: Re-plants all your capabilities into a fresh environment.*

---

## 💾 Backup & Restore

Export your entire AgentReverse setup for portability across machines or agent platforms.

### What Gets Backed Up

| Item | Path | Description |
|------|------|-------------|
| Manifest | `agent-reverse.json` | Installed capabilities list |
| Skills | `.claude/skills/*.md` | Claude Code skills |
| Commands | `.claude/commands/*.md` | User-invocable commands |
| Rules | `.cursor/rules/*.mdc` | Cursor rules |
| CLAUDE.md | `CLAUDE.md` | Project instructions |
| Caches | `workflow-cache.json`, `known-repos.json` | Observer patterns & watched repos |

### Create a Backup

```bash
# Backup to local file (default: agent-reverse-backup-<date>.json)
agent-reverse backup

# Backup with custom filename
agent-reverse backup --output my-backup.json

# Backup to GitHub Gist (private)
agent-reverse backup --gist

# Backup to public Gist
agent-reverse backup --gist --gist-public

# Backup to GitHub repo
agent-reverse backup --repo myuser/agent-backups
```

### Restore from Backup

```bash
# Restore from local file
agent-reverse restore backup.json

# Restore from Gist URL
agent-reverse restore https://gist.github.com/user/abc123

# Restore from GitHub repo
agent-reverse restore https://github.com/user/backups/blob/main/backups/2026-01-26.json
```

### Cross-Agent Restore

Migrate your setup between different agent platforms:

```bash
# Restore Claude skills to Cursor
agent-reverse restore backup.json --target cursor

# Preview what would be restored (dry run)
agent-reverse restore backup.json --target cursor --dry-run
```

*Result: Skills from `.claude/skills/foo.md` become `.cursor/rules/foo.mdc`*

### Restore Options

| Flag | Description |
|------|-------------|
| `--target <agent>` | Convert to different agent: `claude-code`, `cursor`, `antigravity` |
| `--merge` | Merge with existing setup instead of replacing |
| `--force` | Overwrite existing files |
| `--dry-run` | Preview changes without writing |

### MCP Tools

For programmatic access:
- `backup_create` - Create backup archive
- `backup_restore` - Restore from backup
- `backup_list` - List backup contents without restoring

---

## 🧪 Documentation

Explore the deep dives:

- 📄 [PRD](./docs/PRD.md) - Vision and roadmap.
- 🛠️ [Tech Spec](./docs/spec.md) - Architecture and JSON schemas.
- 📋 [Test Cases](./docs/test_case.md) - 15+ real-world usage scenarios.

---

## 🤝 Contributing

AgentReverse is for the community of "Vibe Coders" and Engineers who want a cleaner, faster Future of Coding. PRs for new **Agent Adapters** or **Language Parsers** are highly encouraged.

---

**Build smarter. Code leaner. Reverse the bloat.** 🧬✨
