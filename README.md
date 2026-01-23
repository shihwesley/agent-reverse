# 🧬 AgentReverse

[![npm](https://img.shields.io/npm/v/@shihwesley/agent-reverse)](https://www.npmjs.com/package/@shihwesley/agent-reverse)
[![MCP](https://img.shields.io/badge/MCP-Server-blue.svg)](https://modelcontextprotocol.io/)
[![Protocol](https://img.shields.io/badge/Agent-Portable-green.svg)](#portability)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **"Stop the bloat. Maximize the context. Extract the DNA."**

**AgentReverse** is a surgical integration engine designed to eliminate agent/plugin bloat. Instead of cloning entire repositories just for a single feature, AgentReverse reverse-engineers tools, skills, and plugins to extract only the essential logic—surgically implanting them into your current workflow.

---

## 📦 Installation

### As MCP Server (Claude Code)

```bash
# Option 1: npx (recommended - no install needed)
claude mcp add --transport stdio agent-reverse -- npx -y -p @shihwesley/agent-reverse agent-reverse-server

# Option 2: Global install first
npm install -g @shihwesley/agent-reverse
claude mcp add --transport stdio agent-reverse -- agent-reverse-server
```

Then restart Claude Code. The 25 MCP tools are now available.

### As CLI

```bash
# One-off usage (no install)
npx -y -p @shihwesley/agent-reverse agent-reverse analyze https://github.com/some/repo

# Global install
npm install -g @shihwesley/agent-reverse
agent-reverse analyze https://github.com/some/repo
agent-reverse --help
```

### From Source (Development)

```bash
git clone https://github.com/shihwesley/agent-reverse.git
cd agent-reverse
npm install
npm run build

# Run MCP server locally
claude mcp add --transport stdio agent-reverse -- node dist/server.js

# Run CLI locally
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
