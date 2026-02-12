// conflict_* tools - Phase 4
// Check and resolve capability conflicts

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { loadManifest, saveManifest, getCapability } from './manifest.js';
import { parseSkillFile } from '../parsers/skill.js';
import type {
  Capability,
  ConflictInfo,
  ConflictResolution,
  ConflictStrategy,
  ParsedSkill,
} from '../types.js';

/**
 * Check if a capability ID conflicts with existing installations
 */
export async function checkConflict(
  workspaceRoot: string,
  capabilityId: string,
  incomingSource?: string
): Promise<ConflictInfo> {
  const manifest = await loadManifest(workspaceRoot);
  const existing = manifest.capabilities.find(c => c.id === capabilityId);

  if (!existing) {
    return {
      hasConflict: false,
      options: [],
    };
  }

  // Same source and ID - potential version conflict
  const options: ConflictStrategy[] = ['replace', 'keep_both'];

  // If sources differ, offer synthesis
  if (incomingSource && existing.source !== incomingSource) {
    options.push('synthesize');
  }

  return {
    hasConflict: true,
    existing,
    options,
  };
}

/**
 * Resolve a conflict between existing and incoming capability
 */
export async function resolveConflict(
  workspaceRoot: string,
  options: {
    existingId: string;
    incomingId: string;
    strategy: ConflictStrategy;
    mergedName?: string;
    incomingCapability?: Capability;
  }
): Promise<ConflictResolution> {
  const manifest = await loadManifest(workspaceRoot);
  const existing = manifest.capabilities.find(c => c.id === options.existingId);

  if (!existing) {
    return {
      success: false,
      result: 'replaced',
      superseded: [],
    };
  }

  switch (options.strategy) {
    case 'replace': {
      // Move existing to superseded, incoming takes its place
      manifest.superseded.push({ ...existing, status: 'superseded' });
      manifest.capabilities = manifest.capabilities.filter(c => c.id !== options.existingId);

      if (options.incomingCapability) {
        manifest.capabilities.push({
          ...options.incomingCapability,
          status: 'installed',
          installedAt: new Date().toISOString(),
        });
      }

      await saveManifest(workspaceRoot, manifest);

      return {
        success: true,
        result: 'replaced',
        superseded: [options.existingId],
        newCapability: options.incomingCapability,
      };
    }

    case 'keep_both': {
      // Rename incoming to avoid conflict
      const newId = options.mergedName || `${options.incomingId}-alt`;

      if (options.incomingCapability) {
        const renamed = {
          ...options.incomingCapability,
          id: newId,
          status: 'installed' as const,
          installedAt: new Date().toISOString(),
        };
        manifest.capabilities.push(renamed);
        await saveManifest(workspaceRoot, manifest);

        return {
          success: true,
          result: 'renamed',
          newCapability: renamed,
        };
      }

      return {
        success: false,
        result: 'renamed',
      };
    }

    case 'synthesize': {
      // Merge capabilities into a new synthesized skill
      const newId = options.mergedName || `${options.existingId}-merged`;

      // Read both skill files and merge content
      let synthesisReport = 'Merged capabilities:\n';
      let mergedContent = '';

      for (const file of existing.files) {
        try {
          const content = await readFile(join(workspaceRoot, file), 'utf-8');
          const skill = parseSkillFile(content, file);
          if (skill) {
            mergedContent += `\n# From ${options.existingId}\n${skill.content}\n`;
            synthesisReport += `- ${options.existingId}: ${skill.name}\n`;
          }
        } catch {
          // Skip unreadable files
        }
      }

      if (options.incomingCapability) {
        for (const file of options.incomingCapability.files) {
          try {
            const content = await readFile(join(workspaceRoot, file), 'utf-8');
            const skill = parseSkillFile(content, file);
            if (skill) {
              mergedContent += `\n# From ${options.incomingId}\n${skill.content}\n`;
              synthesisReport += `- ${options.incomingId}: ${skill.name}\n`;
            }
          } catch {
            // Skip unreadable files
          }
        }
      }

      // Create synthesized skill file
      const synthesizedPath = `.claude/skills/${newId}/SKILL.md`;
      const synthesizedContent = `---
name: ${newId}
description: Synthesized from ${options.existingId} and ${options.incomingId}
---

${mergedContent}
`;

      try {
        const fullSynthPath = join(workspaceRoot, synthesizedPath);
        await mkdir(dirname(fullSynthPath), { recursive: true });
        await writeFile(fullSynthPath, synthesizedContent, 'utf-8');
      } catch {
        return {
          success: false,
          result: 'synthesized',
          synthesisReport: 'Failed to write synthesized skill file',
        };
      }

      // Move both to superseded
      manifest.superseded.push({ ...existing, status: 'superseded' });
      manifest.capabilities = manifest.capabilities.filter(c => c.id !== options.existingId);

      // Add synthesized capability
      const synthesized: Capability = {
        id: newId,
        source: 'synthesized',
        commit: 'local',
        files: [synthesizedPath],
        extractedFrom: `${existing.extractedFrom}, ${options.incomingCapability?.extractedFrom || 'unknown'}`,
        dependencies: [...new Set([...existing.dependencies, ...(options.incomingCapability?.dependencies || [])])],
        status: 'installed',
        installedAt: new Date().toISOString(),
      };

      manifest.capabilities.push(synthesized);
      await saveManifest(workspaceRoot, manifest);

      return {
        success: true,
        result: 'synthesized',
        superseded: [options.existingId, options.incomingId],
        newCapability: synthesized,
        synthesisReport,
      };
    }

    default:
      return {
        success: false,
        result: 'replaced',
      };
  }
}

/**
 * Register conflict tools
 */
export function registerConflictTools(server: McpServer): void {
  server.registerTool(
    'conflict_check',
    {
      description: 'Check if a capability ID conflicts with existing installations',
      inputSchema: {
        capabilityId: z.string().describe('ID of capability to check'),
        incomingSource: z.string().optional().describe('Source URL of incoming capability'),
        workspaceRoot: z.string().optional().describe('Workspace root (defaults to cwd)'),
      },
    },
    async ({ capabilityId, incomingSource, workspaceRoot }) => {
      try {
        const root = workspaceRoot || process.cwd();
        const result = await checkConflict(root, capabilityId, incomingSource);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
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

  server.registerTool(
    'conflict_resolve',
    {
      description: 'Resolve a conflict between capabilities using specified strategy',
      inputSchema: {
        existingId: z.string().describe('ID of existing capability'),
        incomingId: z.string().describe('ID of incoming capability'),
        strategy: z.enum(['replace', 'keep_both', 'synthesize']).describe('Resolution strategy'),
        mergedName: z.string().optional().describe('New name for merged/renamed capability'),
        workspaceRoot: z.string().optional().describe('Workspace root (defaults to cwd)'),
      },
    },
    async ({ existingId, incomingId, strategy, mergedName, workspaceRoot }) => {
      try {
        const root = workspaceRoot || process.cwd();
        const result = await resolveConflict(root, {
          existingId,
          incomingId,
          strategy,
          mergedName,
        });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
          isError: !result.success,
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
