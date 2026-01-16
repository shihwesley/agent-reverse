// Cursor installer adapter
// Writes to .cursor/rules/*.mdc (new format)

import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import type { ParsedSkill } from '../types.js';
import type { InstallResult } from './claude.js';

const RULES_DIR = '.cursor/rules';

export async function installForCursor(
  skill: ParsedSkill,
  workspaceRoot: string,
  capabilityId: string
): Promise<InstallResult> {
  const result: InstallResult = {
    filesWritten: [],
    configUpdated: false,
    errors: [],
  };

  try {
    // Ensure rules directory exists
    const rulesPath = join(workspaceRoot, RULES_DIR);
    await mkdir(rulesPath, { recursive: true });

    // Target file: {capabilityId}.mdc
    const targetFileName = `${capabilityId}.mdc`;
    const targetPath = join(rulesPath, targetFileName);

    // Build MDC content with frontmatter
    const mdcContent = buildMdcContent(skill);

    // Write rule file
    await writeFile(targetPath, mdcContent, 'utf-8');
    result.filesWritten.push(join(RULES_DIR, targetFileName));

    // MDC files are self-contained, no separate config update needed
    result.configUpdated = false;

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.errors.push(message);
  }

  return result;
}

function buildMdcContent(skill: ParsedSkill): string {
  // MDC frontmatter fields
  const frontmatter: Record<string, unknown> = {
    description: skill.description,
  };

  // Copy globs if present in original frontmatter
  if (skill.frontmatter.globs) {
    frontmatter.globs = skill.frontmatter.globs;
  }

  // Default to not always applying (only when relevant)
  frontmatter.alwaysApply = skill.frontmatter.alwaysApply ?? false;

  // Build frontmatter string
  const frontmatterLines = Object.entries(frontmatter)
    .map(([key, value]) => {
      if (typeof value === 'boolean') {
        return `${key}: ${value}`;
      }
      if (Array.isArray(value)) {
        return `${key}: ${JSON.stringify(value)}`;
      }
      return `${key}: ${value}`;
    })
    .join('\n');

  return `---
${frontmatterLines}
---

${skill.content}
`;
}
