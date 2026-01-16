// Antigravity installer adapter
// Writes to skills/ and updates agent.md

import type { Capability } from '../types.js';
import type { InstallResult } from './claude.js';

export async function installForAntigravity(
  capability: Capability,
  workspaceRoot: string
): Promise<InstallResult> {
  // TODO: Implement in phase2/multi-agent branch
  return { filesWritten: [], configUpdated: false, errors: ['Antigravity adapter not yet implemented'] };
}
