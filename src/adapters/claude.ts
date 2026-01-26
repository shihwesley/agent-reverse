// Claude Code installer adapter
// Writes to .claude/skills/ and updates CLAUDE.md

import { mkdir, writeFile, readFile, copyFile } from 'fs/promises';
import { join, basename, dirname } from 'path';
import type { Capability } from '../types.js';
import type { ParsedSkill } from '../types.js';

export interface InstallResult {
  filesWritten: string[];
  configUpdated: boolean;
  errors: string[];
}

const SKILLS_DIR = '.claude/skills';
const COMMANDS_DIR = '.claude/commands';
const CONFIG_FILE = 'CLAUDE.md';

function getTargetDir(skill: ParsedSkill): string {
  return skill.frontmatter['user-invocable'] === true
    ? COMMANDS_DIR
    : SKILLS_DIR;
}

export async function installForClaudeCode(
  skill: ParsedSkill,
  sourceRepoPath: string,
  workspaceRoot: string,
  capabilityId: string
): Promise<InstallResult> {
  const result: InstallResult = {
    filesWritten: [],
    configUpdated: false,
    errors: [],
  };

  try {
    // Determine target directory based on user-invocable frontmatter
    const targetDir = getTargetDir(skill);
    const targetDirPath = join(workspaceRoot, targetDir);
    await mkdir(targetDirPath, { recursive: true });

    // Determine target filename
    const targetFileName = `${capabilityId}.md`;
    const targetPath = join(targetDirPath, targetFileName);

    // Build skill content with frontmatter
    const skillContent = buildSkillContent(skill, capabilityId);

    // Write skill file
    await writeFile(targetPath, skillContent, 'utf-8');
    result.filesWritten.push(join(targetDir, targetFileName));

    // Update CLAUDE.md with usage hint
    const configUpdated = await updateClaudeMd(workspaceRoot, skill, capabilityId);
    result.configUpdated = configUpdated;

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.errors.push(message);
  }

  return result;
}

function buildSkillContent(skill: ParsedSkill, capabilityId: string): string {
  // Rebuild frontmatter
  const frontmatter: Record<string, unknown> = {
    ...skill.frontmatter,
    name: skill.name,
    description: skill.description,
    'agent-reverse-id': capabilityId,
  };

  const frontmatterStr = Object.entries(frontmatter)
    .map(([key, value]) => {
      if (typeof value === 'string') {
        return `${key}: ${value}`;
      }
      return `${key}: ${JSON.stringify(value)}`;
    })
    .join('\n');

  return `---
${frontmatterStr}
---

${skill.content}
`;
}

async function updateClaudeMd(
  workspaceRoot: string,
  skill: ParsedSkill,
  capabilityId: string
): Promise<boolean> {
  const configPath = join(workspaceRoot, CONFIG_FILE);

  try {
    let content = '';
    try {
      content = await readFile(configPath, 'utf-8');
    } catch {
      // File doesn't exist, create minimal one
      content = `# CLAUDE.md\n\n`;
    }

    // Check if already has AgentReverse section
    const sectionMarker = '## AgentReverse Capabilities';
    if (!content.includes(sectionMarker)) {
      content += `\n${sectionMarker}\n\nInstalled via AgentReverse:\n`;
    }

    // Check if this capability is already listed
    const capabilityMarker = `- \`${capabilityId}\``;
    if (content.includes(capabilityMarker)) {
      return false; // Already listed
    }

    // Add capability to list
    const insertPoint = content.indexOf(sectionMarker) + sectionMarker.length;
    const beforeSection = content.slice(0, insertPoint);
    const afterSection = content.slice(insertPoint);

    // Find where to insert (after "Installed via AgentReverse:" line)
    const listStart = afterSection.indexOf('Installed via AgentReverse:');
    if (listStart !== -1) {
      const listEnd = listStart + 'Installed via AgentReverse:'.length;
      const before = afterSection.slice(0, listEnd);
      const after = afterSection.slice(listEnd);
      content = beforeSection + before + `\n${capabilityMarker}: ${skill.description}` + after;
    } else {
      content = beforeSection + afterSection + `\n${capabilityMarker}: ${skill.description}\n`;
    }

    await writeFile(configPath, content, 'utf-8');
    return true;

  } catch {
    return false;
  }
}

// Copy raw file (for non-skill files)
export async function copyFileToSkills(
  sourcePath: string,
  workspaceRoot: string,
  targetName: string,
  userInvocable?: boolean
): Promise<string> {
  const targetDir = userInvocable ? COMMANDS_DIR : SKILLS_DIR;
  const targetDirPath = join(workspaceRoot, targetDir);
  await mkdir(targetDirPath, { recursive: true });

  const targetPath = join(targetDirPath, targetName);
  await copyFile(sourcePath, targetPath);

  return join(targetDir, targetName);
}
