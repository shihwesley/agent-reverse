// manifest_audit tool - Phase 4
// Detect duplicates, bloat, and orphaned skills

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readFile, readdir, stat } from 'fs/promises';
import { join, relative } from 'path';
import { loadManifest } from './manifest.js';
import { parseSkillFile } from '../parsers/skill.js';
import type {
  AuditResult,
  DuplicateGroup,
  BloatEntry,
  AuditStats,
  Capability,
  ParsedSkill,
} from '../types.js';

// Default paths to scan for skills
const DEFAULT_SKILL_PATHS = [
  '.claude/skills',
  'skills',
  '.cursor/rules',
  '.antigravity/skills',
];

// Keywords for detecting functional overlap
const FUNCTIONALITY_KEYWORDS: Record<string, string[]> = {
  'file-search': ['search', 'find', 'glob', 'grep', 'locate'],
  'code-review': ['review', 'lint', 'analyze', 'quality'],
  'git-operations': ['git', 'commit', 'branch', 'merge', 'push'],
  'testing': ['test', 'spec', 'jest', 'mocha', 'pytest'],
  'documentation': ['doc', 'readme', 'comment', 'jsdoc'],
  'formatting': ['format', 'prettier', 'eslint', 'style'],
  'debugging': ['debug', 'trace', 'log', 'breakpoint'],
  'refactoring': ['refactor', 'rename', 'extract', 'inline'],
};

/**
 * Recursively find skill files in a directory
 */
async function findSkillFiles(dir: string, base = ''): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const relativePath = base ? `${base}/${entry.name}` : entry.name;
      const fullPath = join(dir, entry.name);

      if (entry.name.startsWith('.') && entry.name !== '.claude') continue;

      if (entry.isDirectory()) {
        results.push(...await findSkillFiles(fullPath, relativePath));
      } else if (entry.name.endsWith('.md')) {
        results.push(relativePath);
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }
  return results;
}

/**
 * Detect functionality from skill content
 */
function detectFunctionality(skill: ParsedSkill): string[] {
  const detected: string[] = [];
  const searchText = `${skill.name} ${skill.description} ${skill.content}`.toLowerCase();

  for (const [functionality, keywords] of Object.entries(FUNCTIONALITY_KEYWORDS)) {
    if (keywords.some(kw => searchText.includes(kw))) {
      detected.push(functionality);
    }
  }

  return detected;
}

/**
 * Find duplicate/overlapping capabilities
 */
function findDuplicates(
  capabilities: Capability[],
  skills: Map<string, ParsedSkill>
): DuplicateGroup[] {
  const functionalityMap = new Map<string, string[]>();

  for (const cap of capabilities) {
    const skill = skills.get(cap.id);
    if (!skill) continue;

    const functionalities = detectFunctionality(skill);
    for (const func of functionalities) {
      const existing = functionalityMap.get(func) || [];
      existing.push(cap.id);
      functionalityMap.set(func, existing);
    }
  }

  const duplicates: DuplicateGroup[] = [];
  for (const [functionality, capIds] of functionalityMap) {
    if (capIds.length > 1) {
      duplicates.push({
        functionality,
        capabilities: capIds,
        recommendation: `Consider consolidating ${capIds.join(', ')} - they all handle ${functionality}`,
      });
    }
  }

  return duplicates;
}

/**
 * Find bloat (orphaned, outdated, superseded)
 */
function findBloat(
  capabilities: Capability[],
  superseded: Capability[],
  diskFiles: string[],
  manifestFiles: Set<string>
): BloatEntry[] {
  const bloat: BloatEntry[] = [];

  // Orphaned files (on disk but not in manifest)
  for (const file of diskFiles) {
    if (!manifestFiles.has(file)) {
      bloat.push({
        id: file,
        reason: 'orphan',
        details: `File exists on disk but not tracked in manifest`,
      });
    }
  }

  // Superseded capabilities
  for (const cap of superseded) {
    bloat.push({
      id: cap.id,
      reason: 'superseded',
      details: `Replaced by newer version from ${cap.source}`,
    });
  }

  return bloat;
}

/**
 * Generate consolidation plan
 */
function generateConsolidationPlan(
  duplicates: DuplicateGroup[],
  bloat: BloatEntry[]
): string {
  const lines: string[] = ['# Consolidation Plan\n'];

  if (duplicates.length > 0) {
    lines.push('## Duplicate Functionality\n');
    for (const dup of duplicates) {
      lines.push(`- **${dup.functionality}**: ${dup.capabilities.join(', ')}`);
      lines.push(`  Action: Review and merge into single capability\n`);
    }
  }

  const orphans = bloat.filter(b => b.reason === 'orphan');
  if (orphans.length > 0) {
    lines.push('## Orphaned Files\n');
    for (const orphan of orphans) {
      lines.push(`- ${orphan.id}`);
      lines.push(`  Action: Either add to manifest or delete\n`);
    }
  }

  const superseded = bloat.filter(b => b.reason === 'superseded');
  if (superseded.length > 0) {
    lines.push('## Superseded Capabilities\n');
    for (const sup of superseded) {
      lines.push(`- ${sup.id}`);
      lines.push(`  Action: Remove old files if no longer needed\n`);
    }
  }

  if (duplicates.length === 0 && bloat.length === 0) {
    lines.push('No issues found. Manifest is clean.\n');
  }

  return lines.join('\n');
}

/**
 * Run manifest audit
 */
export async function runAudit(
  workspaceRoot: string,
  options: {
    paths?: string[];
    includeOrphans?: boolean;
    checkUpdates?: boolean;
  } = {}
): Promise<AuditResult> {
  const manifest = await loadManifest(workspaceRoot);
  const scanPaths = options.paths || DEFAULT_SKILL_PATHS;

  // Collect all skill files from disk
  const diskFiles: string[] = [];
  for (const scanPath of scanPaths) {
    const fullPath = join(workspaceRoot, scanPath);
    const files = await findSkillFiles(fullPath);
    diskFiles.push(...files.map(f => join(scanPath, f)));
  }

  // Build set of files tracked in manifest
  const manifestFiles = new Set<string>();
  for (const cap of manifest.capabilities) {
    for (const file of cap.files) {
      manifestFiles.add(file);
    }
  }

  // Parse skills for content analysis
  const skills = new Map<string, ParsedSkill>();
  for (const cap of manifest.capabilities) {
    for (const file of cap.files) {
      try {
        const content = await readFile(join(workspaceRoot, file), 'utf-8');
        const skill = parseSkillFile(content, file);
        if (skill) {
          skills.set(cap.id, skill);
          break; // One skill per capability
        }
      } catch {
        // File doesn't exist or can't be read
      }
    }
  }

  // Find duplicates
  const duplicates = findDuplicates(manifest.capabilities, skills);

  // Find bloat
  const bloat = options.includeOrphans !== false
    ? findBloat(manifest.capabilities, manifest.superseded, diskFiles, manifestFiles)
    : findBloat(manifest.capabilities, manifest.superseded, [], manifestFiles);

  // Calculate stats
  const stats: AuditStats = {
    total: manifest.capabilities.length + manifest.superseded.length,
    installed: manifest.capabilities.length,
    superseded: manifest.superseded.length,
    orphaned: bloat.filter(b => b.reason === 'orphan').length,
  };

  // Generate consolidation plan
  const consolidationPlan = generateConsolidationPlan(duplicates, bloat);

  return {
    duplicates,
    bloat,
    stats,
    consolidationPlan,
  };
}

/**
 * Register audit tools
 */
export function registerAuditTools(server: McpServer): void {
  server.registerTool(
    'manifest_audit',
    {
      description: 'Audit manifest for duplicates, bloat, and orphaned skills',
      inputSchema: {
        workspaceRoot: z.string().optional().describe('Workspace root (defaults to cwd)'),
        paths: z.array(z.string()).optional().describe('Directories to scan for skills'),
        includeOrphans: z.boolean().optional().default(true).describe('Check for orphaned files'),
        checkUpdates: z.boolean().optional().default(false).describe('Check for available updates'),
      },
    },
    async ({ workspaceRoot, paths, includeOrphans, checkUpdates }) => {
      try {
        const root = workspaceRoot || process.cwd();
        const result = await runAudit(root, {
          paths,
          includeOrphans,
          checkUpdates,
        });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              stats: result.stats,
              duplicateCount: result.duplicates.length,
              duplicates: result.duplicates,
              bloatCount: result.bloat.length,
              bloat: result.bloat,
              consolidationPlan: result.consolidationPlan,
            }, null, 2),
          }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    }
  );
}
