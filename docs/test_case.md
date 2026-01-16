# Test Cases & Usage Examples: AgentReverse

This document outlines practical scenarios where AgentReverse can be used to streamline workflows, reduce bloat, and enhance agent capabilities.

---

## Scenario 1: Surgical Feature Extraction (GitHub)

**User Intent**: "I like the way this repo handles context window management, but I don't want the rest of the bloat."
**Input**: `https://github.com/example/complex-agent-framework`
**Agent Command**: `/agent-reverse analyze https://github.com/example/complex-agent-framework`

**Interaction**:

1. AgentReverse clones the repo (shallow) and parses it.
2. It returns a "Bill of Materials" (BOM):
   - Skill: `context-winnowing` (proactive token reduction)
   - Tool: `git-history-search`
   - Prompt: `structured-task-breakdown`
3. **User**: "Extract `context-winnowing` and install it for my Claude Code setup."
4. **AgentReverse**: Extracts logic, converts it to a `.claude/skills/context-winnowing.md` file, adds a usage hint to `CLAUDE.md`, and updates `agent-reverse.json`.

---

## Scenario 2: Proactive Capability Setup

**User Intent**: "I found a cool repo, set it up for me."
**Input**: `https://github.com/vibe-coder/cool-plugins`
**Agent Command**: `Use AgentReverse to see what's useful in this repo and set it up: https://github.com/vibe-coder/cool-plugins`

**Interaction**:

1. AgentReverse identifies a set of MCP tools and specialized prompts.
2. It asks: "This repo has a really good 'Image-to-React' component extractor. Should I install it as an MCP tool and add the workflow rules to your `agent.md`?"
3. **User**: "Yes."
4. AgentReverse configures the MCP server, adds the rule, and verifies the setup.

---

## Scenario 3: Legacy Setup Audit & Optimization

**User Intent**: "My environment is slow. I have too many skills and I don't know what's overlapping."
**Agent Command**: `/agent-reverse audit`

**Interaction**:

1. AgentReverse scans `.claude/skills/`, `skills/`, and all connected MCP servers.
2. **Analysis Report**:
   - **RED**: 3 overlapping file-search tools found (Skill A, Skill B, MCP C).
   - **YELLOW**: `web-search-old` is outdated (Source HEAD is 10 commits ahead).
   - **GREEN**: 5 unique capabilities.
3. **Optimization Plan**: "I can merge the 3 file-search tools into a single 'Ultimate Search' tool that uses the best logic from each. Shall I proceed?"

---

## Scenario 4: Workflow Hardening (claude.md / agent.md)

**User Intent**: "My current search workflow is buggy. Optimize it."
**Agent Command**: `AgentReverse, analyze my search-related skills and plugins, then write better rules in my CLAUDE.md.`

**Interaction**:

1. AgentReverse looks at how current search features are implemented.
2. It realizes the user often forgets to specify a directory.
3. It updates `CLAUDE.md` with a new "Invisible Integration" rule:
   > "When searching, if no path is provided, default to current workspace root and use the `google-search-lite` capability to verify external context first."

---

## Scenario 5: Research-to-Code Implementation (Deep Feature)

**User Intent**: "Look at this blog post on Reasoning with Language Models (RLM) and implement the core idea for me."
**Input**: `https://alexzhang13.github.io/blog/2025/rlm/`
**Agent Command**: `/agent-reverse interpret https://alexzhang13.github.io/blog/2025/rlm/ and implement as a skill.`

**Interaction**:

1. AgentReverse reads the article text.
2. It identifies the "Core Idea": Recursive refinement of internal search queries before external retrieval.
3. **Synthesis**: It creates a new skill `rlm-search.md` that implements this recursive logic using the user's existing search tools.
4. **Portability**: It adds this "Custom Synthesis" to `agent-reverse.json` so it can be recreated elsewhere.

---

## Scenario 6: Zero-Friction Migration (Sync)

**User Intent**: "I just switched to a new laptop. Get my agent back to how it was."
**Agent Command**: `/agent-reverse sync`

**Interaction**:

1. AgentReverse reads `agent-reverse.json`.
2. It sees 12 pinned capabilities from various repos.
3. It fetches each repo at the pinned commit, extracts the features, and re-implants them into the new environment.
4. **Result**: Identical workflow restored in minutes without manual cloning.
