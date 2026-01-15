// Cursor installer adapter
// Writes to .cursor/rules/ and updates .cursorrules

import type { Capability } from '../types.js';
import type { InstallResult } from './claude.js';

export async function installForCursor(
  capability: Capability,
  workspaceRoot: string
): Promise<InstallResult> {
  // TODO: Implement in phase2/multi-agent branch
  return { filesWritten: [], configUpdated: false };
}
