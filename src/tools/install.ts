// install_capability tool - Phase 1
// Write extracted files to target agent's location

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { installForClaudeCode } from '../adapters/claude.js';
import { installForCursor } from '../adapters/cursor.js';
import { installForAntigravity } from '../adapters/antigravity.js';
import { addCapability } from './manifest.js';
import { parseSkillFile } from '../parsers/skill.js';
import type { TargetAgent, ParsedSkill, InstallScope } from '../types.js';

export interface InstallOptions {
  skillPath: string;        // Path to skill file in cloned repo
  sourceRepoPath: string;   // Path to cloned repo
  sourceUrl: string;        // GitHub URL
  commit: string;           // Commit hash
  capabilityId: string;     // ID for this capability
  targetAgent: TargetAgent; // Target agent system
  workspaceRoot: string;    // Where to install
  scope?: InstallScope;     // For Antigravity: 'project' or 'global'
}

export interface InstallResultFull {
  success: boolean;
  capabilityId: string;
  filesWritten: string[];
  configUpdated: boolean;
  manifestUpdated: boolean;
  errors: string[];
}

export async function installCapability(options: InstallOptions): Promise<InstallResultFull> {
  const result: InstallResultFull = {
    success: false,
    capabilityId: options.capabilityId,
    filesWritten: [],
    configUpdated: false,
    manifestUpdated: false,
    errors: [],
  };

  try {
    // Read and parse the skill file
    const fullSkillPath = join(options.sourceRepoPath, options.skillPath);
    const content = await readFile(fullSkillPath, 'utf-8');
    const skill = parseSkillFile(content, options.skillPath);

    if (!skill) {
      result.errors.push(`Failed to parse skill file: ${options.skillPath}`);
      return result;
    }

    // Install based on target agent
    let installResult;
    switch (options.targetAgent) {
      case 'claude-code':
        installResult = await installForClaudeCode(
          skill,
          options.sourceRepoPath,
          options.workspaceRoot,
          options.capabilityId
        );
        break;

      case 'cursor':
        installResult = await installForCursor(
          skill,
          options.workspaceRoot,
          options.capabilityId
        );
        break;

      case 'antigravity':
        installResult = await installForAntigravity(
          skill,
          options.workspaceRoot,
          options.capabilityId,
          options.scope ?? 'project'
        );
        break;

      case 'custom':
        result.errors.push(`Target agent 'custom' not yet supported`);
        return result;

      default:
        result.errors.push(`Unknown target agent: ${options.targetAgent}`);
        return result;
    }

    result.filesWritten = installResult.filesWritten;
    result.configUpdated = installResult.configUpdated;
    result.errors.push(...installResult.errors);

    if (installResult.errors.length > 0) {
      return result;
    }

    // Update manifest
    const userInvocable = skill.frontmatter['user-invocable'] === true;
    const manifestResult = await addCapability(options.workspaceRoot, {
      id: options.capabilityId,
      source: options.sourceUrl,
      commit: options.commit,
      files: installResult.filesWritten,
      extractedFrom: options.skillPath,
      dependencies: [],
      status: 'installed',
      installedAt: new Date().toISOString(),
      userInvocable,
    });

    result.manifestUpdated = manifestResult.success;
    if (!manifestResult.success) {
      result.errors.push(manifestResult.message);
    }

    result.success = result.errors.length === 0;

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.errors.push(message);
  }

  return result;
}

export function registerInstallTool(server: McpServer): void {
  server.registerTool(
    'install_capability',
    {
      description: 'Install a skill/capability from a cloned repo to the target agent system',
      inputSchema: {
        skillPath: z.string().describe('Path to skill file within the cloned repo'),
        sourceRepoPath: z.string().describe('Path to the cloned repo (from repo_fetch)'),
        sourceUrl: z.string().describe('GitHub URL of source repo'),
        commit: z.string().describe('Commit hash for pinning'),
        capabilityId: z.string().describe('Unique ID for this capability'),
        targetAgent: z.enum(['claude-code', 'cursor', 'antigravity', 'custom'])
          .default('claude-code')
          .describe('Target agent system'),
        workspaceRoot: z.string().optional().describe('Workspace root (defaults to cwd)'),
        scope: z.enum(['project', 'global'])
          .optional()
          .describe('Install scope for Antigravity: project-local or user-global'),
      },
    },
    async ({ skillPath, sourceRepoPath, sourceUrl, commit, capabilityId, targetAgent, workspaceRoot, scope }) => {
      const result = await installCapability({
        skillPath,
        sourceRepoPath,
        sourceUrl,
        commit,
        capabilityId,
        targetAgent: targetAgent as TargetAgent,
        workspaceRoot: workspaceRoot || process.cwd(),
        scope: scope as InstallScope | undefined,
      });

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        }],
        isError: !result.success,
      };
    }
  );
}
