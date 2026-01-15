// Claude Code installer adapter
// Writes to .claude/skills/ and updates CLAUDE.md

import type { Capability } from '../types.js';

export interface InstallResult {
  filesWritten: string[];
  configUpdated: boolean;
}

export async function installForClaudeCode(
  capability: Capability,
  workspaceRoot: string
): Promise<InstallResult> {
  // TODO: Implement in phase1/installer branch
  return { filesWritten: [], configUpdated: false };
}
