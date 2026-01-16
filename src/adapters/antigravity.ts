// Antigravity installer adapter
// Writes to .agent/skills/{id}/SKILL.md (project) or ~/.gemini/antigravity/skills/{id}/SKILL.md (global)

import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import type { ParsedSkill, InstallScope } from '../types.js';
import type { InstallResult } from './claude.js';

const PROJECT_SKILLS_DIR = '.agent/skills';
const GLOBAL_SKILLS_DIR = '.gemini/antigravity/skills';

export async function installForAntigravity(
  skill: ParsedSkill,
  workspaceRoot: string,
  capabilityId: string,
  scope: InstallScope = 'project'
): Promise<InstallResult> {
  const result: InstallResult = {
    filesWritten: [],
    configUpdated: false,
    errors: [],
  };

  try {
    // Determine base path based on scope
    const basePath = scope === 'global'
      ? join(homedir(), GLOBAL_SKILLS_DIR)
      : join(workspaceRoot, PROJECT_SKILLS_DIR);

    // Each skill gets its own subdirectory
    const skillDir = join(basePath, capabilityId);
    await mkdir(skillDir, { recursive: true });

    // Target file: SKILL.md inside subdirectory
    const targetPath = join(skillDir, 'SKILL.md');

    // Build SKILL.md content
    const skillContent = buildSkillMdContent(skill);

    // Write skill file
    await writeFile(targetPath, skillContent, 'utf-8');

    // Record relative path from appropriate root
    const relativePath = scope === 'global'
      ? join('~', GLOBAL_SKILLS_DIR, capabilityId, 'SKILL.md')
      : join(PROJECT_SKILLS_DIR, capabilityId, 'SKILL.md');
    result.filesWritten.push(relativePath);

    // SKILL.md files are self-contained, no separate config update needed
    result.configUpdated = false;

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.errors.push(message);
  }

  return result;
}

function buildSkillMdContent(skill: ParsedSkill): string {
  // SKILL.md uses simple name/description frontmatter
  const frontmatterLines = [
    `name: ${skill.name}`,
    `description: ${skill.description}`,
  ];

  return `---
${frontmatterLines.join('\n')}
---

${skill.content}
`;
}
