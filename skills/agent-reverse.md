---
name: agent-reverse
description: Extract and install capabilities from GitHub repos into your agent workflow
---

# AgentReverse

Surgical extraction of agent capabilities from GitHub repos. Prevents bloat by installing only what you need.

## Commands

### `/agent-reverse analyze <url>`
Analyze a GitHub repo for extractable capabilities.

**Steps:**
1. Call `repo_fetch` with the URL to clone the repo
2. Call `repo_analyze` with the cloned path to get Bill of Materials
3. Present the capabilities found (skills, tools, plugins)
4. Ask user which capabilities to install
5. Call `repo_cleanup` when done

**Example:**
```
User: /agent-reverse analyze https://github.com/anthropics/claude-code-plugins
You: Analyzing repo... Found 5 skills, 2 MCP tools. Which would you like to install?
```

### `/agent-reverse install <id>`
Install a capability from a previously analyzed repo.

**Steps:**
1. Verify the repo is still cloned (or re-fetch if needed)
2. Call `install_capability` with:
   - `skillPath`: path to the skill file in repo
   - `sourceRepoPath`: cloned repo path
   - `sourceUrl`: GitHub URL
   - `commit`: pinned commit hash
   - `capabilityId`: the ID user specified
   - `targetAgent`: detect from current environment (claude-code, cursor, antigravity)
3. Report success/failure and files written

**Example:**
```
User: /agent-reverse install code-review
You: Installing code-review... Written to .claude/skills/code-review.md. Added to manifest.
```

### `/agent-reverse sync`
Reinstall all capabilities from the manifest.

**Steps:**
1. Call `manifest_sync` tool
2. Report installed/failed/skipped counts
3. List any failures with error messages

**Use case:** Setting up a new environment or recovering after cleanup.

**Example:**
```
User: /agent-reverse sync
You: Synced 5 capabilities. 5 installed, 0 failed, 1 skipped (superseded).
```

### `/agent-reverse audit`
Check for bloat, duplicates, and optimization opportunities.

**Steps:**
1. Call `manifest_list` to get current capabilities
2. Scan local skills directory for untracked files
3. Identify potential duplicates or overlaps
4. Report findings and suggest consolidation

**Example:**
```
User: /agent-reverse audit
You: Found 3 capabilities in manifest. 2 untracked skill files. Potential duplicate: search-web and web-search have similar descriptions.
```

### `/agent-reverse check-updates`
Check if installed capabilities have newer versions.

**Steps:**
1. Call `manifest_check_updates` tool
2. List outdated capabilities with pinned vs latest commits
3. Offer to update specific capabilities

**Example:**
```
User: /agent-reverse check-updates
You: 2 outdated: code-review (a1b2c3d → f4e5d6c), test-runner (1234567 → 89abcde). Update?
```

### `/agent-reverse backup [options]`
Create a backup of all capabilities, skills, and configs.

**Steps:**
1. Call `backup_create` tool with options:
   - No options: saves to `agent-reverse-backup-<date>.json`
   - `--gist`: upload to GitHub Gist (private by default)
   - `--gist --public`: upload as public gist
   - `--repo owner/name`: push to GitHub repo
2. Report backup location and file count

**Example:**
```
User: /agent-reverse backup
You: Backup created: agent-reverse-backup-2026-01-31.json (11 capabilities, 16 files)

User: /agent-reverse backup --gist
You: Backup uploaded to gist: https://gist.github.com/user/abc123
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
User: /agent-reverse restore ./agent-reverse-backup.json
You: Restored 11 capabilities, 16 files.

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
You: Backup contains: 11 capabilities, 16 files. Created: 2026-01-31.
```

## Target Agent Detection

Detect the current agent system:
- If `.claude/` exists → `claude-code`
- If `.cursor/` exists → `cursor`
- If `.agent/` exists → `antigravity`
- Otherwise → ask user

## Tips

- Always pin to specific commits for reproducibility
- Use `audit` periodically to keep your setup lean
- The manifest (`agent-reverse.json`) is portable - copy it to new environments and `sync`
