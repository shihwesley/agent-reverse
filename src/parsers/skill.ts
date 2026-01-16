// Skill markdown parser
// Extract frontmatter and content from .md skill files

import yaml from 'js-yaml';
import type { ParsedSkill } from '../types.js';

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export function parseSkillFile(content: string, filePath: string): ParsedSkill | null {
  const match = content.match(FRONTMATTER_REGEX);

  if (!match) {
    // No frontmatter - might still be a skill if it has skill-like structure
    // For now, require frontmatter
    return null;
  }

  const [, frontmatterStr, body] = match;

  try {
    const frontmatter = yaml.load(frontmatterStr) as Record<string, unknown>;

    // Must have at least a name or description to be considered a skill
    const name = (frontmatter.name as string) || extractNameFromPath(filePath);
    const description = (frontmatter.description as string) || '';

    if (!name) return null;

    return {
      name,
      description,
      filePath,
      frontmatter,
      content: body.trim(),
    };
  } catch {
    // Invalid YAML
    return null;
  }
}

function extractNameFromPath(filePath: string): string {
  const fileName = filePath.split('/').pop() || '';
  return fileName.replace(/\.md$/i, '');
}

// Check if a file path looks like a skill file
export function isSkillPath(filePath: string): boolean {
  const lower = filePath.toLowerCase();

  // Common skill locations
  if (lower.includes('/skills/') || lower.includes('/skill/')) return true;
  if (lower.includes('/prompts/') || lower.includes('/prompt/')) return true;

  // Skip common non-skill markdown
  if (lower.endsWith('/readme.md')) return false;
  if (lower.endsWith('/changelog.md')) return false;
  if (lower.endsWith('/contributing.md')) return false;
  if (lower.endsWith('/license.md')) return false;
  if (lower.includes('/docs/') && !lower.includes('/skills/')) return false;

  // .md in root or specific folders might be skill
  return lower.endsWith('.md');
}
