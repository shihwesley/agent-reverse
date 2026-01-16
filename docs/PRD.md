# PRD: AgentReverse

## Vision

A "surgical" integration tool that prevents agent/plugin bloat by reverse-engineering existing tools and extracting only the necessary "DNA" (code, prompts, or logic) for a streamlined, high-performance workflow.

## Core Philosophy

> **Every token counts.**

The fundamental goal of AgentReverse is to **maximize the utility of every byte in the context window**. As users install more skills, plugins, and MCPs, their agent's context becomes cluttered with overlapping, redundant, or underutilized code. This directly degrades agent performance.

AgentReverse combats this by:

1. **Extracting only what's needed** — no full repo clones, just the essential logic.
2. **Synthesizing duplicates** — merging overlapping capabilities into a single, optimized version.
3. **Centralizing knowledge** — one manifest, one source of truth, minimal file sprawl.
4. **Invisible integration** — extracted features are documented so the agent *just knows* when to use them. Users don't need to remember special prompts or tool names.
5. **Workflow gap detection** — analyze user's current setup to identify missing behaviors, friction points, and optimization opportunities. When a gap is discovered (e.g., "session resume wasn't automatic"), AgentReverse captures this as a learnable pattern and either extracts a solution from known repos or suggests adding it to the user's config.

The result: **a leaner, faster, smarter agent workflow**.

## The Problem

- **Bloat**: Users install whole plugins for a single feature.
- **Context Shrinkage**: Large skill folders and complex MCPs consume token budget.
- **Complexity**: Integrating parts of different tools requires deep technical knowledge.
- **Portability**: Users lack a way to "sync" their custom-built agent capabilities across different environments or IDEs.
- **Fragmentation**: Skills, plugins, and MCPs are scattered across many GitHub repos with no standard format.

## Core Features (MVP)

1. **Source Analysis**: Given a GitHub URL, provide a "Bill of Materials" of its capabilities (skills, tools, prompts).
2. **Feature Extraction**: Identify and isolate specific routines, MCP tools, or prompt-based skills within a codebase.
3. **Surgical Implementation**: Generate a streamlined implementation and write usage instructions to the appropriate agent config file (`claude.md`, `agent.md`).
4. **Agent Requirements Manifest**: A `requirements.txt`-style file (`agent-reverse.json`) that tracks all installed features, their source repos, versioning, and target agent system.
5. **Portability & Recovery**: One-command re-installation (`sync`) of all integrated features for a new environment.
6. **Conflict Resolution & Synthesis**: When a new capability overlaps with an existing one, analyze differences and synthesize an improved, combined version.
7. **Dependency Resolution**: Automatically install dependent capabilities if Capability A requires Capability B.
8. **Version Management**: Check for updates against source repo `HEAD`; support rollback/uninstall.
9. **Audit & Slim**: Scan an existing setup (local folders or list of repo URLs) for all installed skills/plugins/MCPs, identify duplicates and bloat, and propose a consolidation plan.
10. **Workflow Gap Detection**: Analyze user's current workflow to identify friction points and missing behaviors, then either extract solutions from known repos or generate config additions.

## Workflow Gap Detection (Detail)

AgentReverse doesn't just extract features from external repos — it learns from user interactions to identify **what's missing**.

**How it works:**
1. **Observe friction**: When a user manually does something repeatedly (e.g., "check git state on session start"), log it as a pattern.
2. **Match to solutions**: Search known repos/skills for existing solutions to the observed friction.
3. **Generate if needed**: If no external solution exists, generate the minimal config change (e.g., add to CLAUDE.md).
4. **Track improvements**: Record what was added and why, so the manifest becomes a history of workflow optimizations.

**Example workflow gaps:**
- Session resume not automatic → Add git state check to CLAUDE.md
- Repeated web fetches for same docs → Add doc caching behavior
- Manual worktree creation → Extract/generate worktree skill
- Forgetting to run tests → Add pre-commit reminder

**Output**: Each detected gap becomes either:
- An extracted capability (from external repo)
- A generated config snippet (for CLAUDE.md/agent.md)
- A logged "known friction" for future resolution

## Target Audience

- **Software Engineers**: Wanting to modularize their toolchain.
- **"Vibe Coders"**: Non-technical users who want to "remix" agent capabilities and take them wherever they go.

## Target Agent Systems

AgentReverse is **multi-agent aware**. The manifest tracks which agent system a capability was installed for, and the `sync` tool adapts installation steps accordingly.

- Claude Code
- Antigravity
- Cursor (Agent mode)
- Custom/Other

## Target System

- Architecture: **MCP (Model Context Protocol) Server**.
- Primary Language: **TypeScript/Node.js**.
- LLM Dependency: **None**. The host agent (e.g., Claude Code) performs analysis using AgentReverse's tools.

## Success Metrics

- Reduction in total files in `skills/` or `mcp/` directories while maintaining the same utility.
- Successful extraction and integration of a "Tool" from a repo into the user's local setup in under 60 seconds.
- Successful "Restore" of a workflow onto a clean environment using only the manifest file.
- Successful synthesis of two overlapping capabilities into a single, improved version.
