// deps_* tools - Phase 4
// Dependency checking and resolution

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { loadManifest, getCapability } from './manifest.js';
import { parseSkillFile } from '../parsers/skill.js';
import type {
  Capability,
  DepsCheckResult,
  DepsResolveResult,
} from '../types.js';

/**
 * Parse dependencies from skill frontmatter
 */
function parseDependencies(frontmatter: Record<string, unknown>): string[] {
  const deps = frontmatter.dependencies;
  if (!deps) return [];

  if (Array.isArray(deps)) {
    return deps.filter((d): d is string => typeof d === 'string');
  }

  if (typeof deps === 'string') {
    return deps.split(',').map(d => d.trim()).filter(Boolean);
  }

  return [];
}

/**
 * Build dependency graph and detect cycles
 */
function buildDependencyGraph(
  capabilities: Capability[]
): { graph: Map<string, string[]>; hasCycle: boolean } {
  const graph = new Map<string, string[]>();

  for (const cap of capabilities) {
    graph.set(cap.id, cap.dependencies || []);
  }

  // Detect cycles using DFS
  const visited = new Set<string>();
  const recStack = new Set<string>();

  function hasCycleDFS(node: string): boolean {
    if (recStack.has(node)) return true;
    if (visited.has(node)) return false;

    visited.add(node);
    recStack.add(node);

    const deps = graph.get(node) || [];
    for (const dep of deps) {
      if (hasCycleDFS(dep)) return true;
    }

    recStack.delete(node);
    return false;
  }

  for (const cap of capabilities) {
    if (hasCycleDFS(cap.id)) {
      return { graph, hasCycle: true };
    }
  }

  return { graph, hasCycle: false };
}

/**
 * Topological sort for install order
 */
function topologicalSort(
  startNode: string,
  graph: Map<string, string[]>,
  installed: Set<string>
): string[] {
  const result: string[] = [];
  const visited = new Set<string>();

  function visit(node: string) {
    if (visited.has(node) || installed.has(node)) return;
    visited.add(node);

    const deps = graph.get(node) || [];
    for (const dep of deps) {
      visit(dep);
    }

    result.push(node);
  }

  // First visit all dependencies
  const deps = graph.get(startNode) || [];
  for (const dep of deps) {
    visit(dep);
  }

  return result;
}

/**
 * Check if a capability's dependencies are satisfied
 */
export async function checkDeps(
  workspaceRoot: string,
  capabilityId: string
): Promise<DepsCheckResult> {
  const manifest = await loadManifest(workspaceRoot);
  const capability = manifest.capabilities.find(c => c.id === capabilityId);

  if (!capability) {
    return {
      satisfied: false,
      missing: [`Capability '${capabilityId}' not found`],
    };
  }

  const installedIds = new Set(manifest.capabilities.map(c => c.id));
  const missing: string[] = [];

  for (const dep of capability.dependencies) {
    if (!installedIds.has(dep)) {
      missing.push(dep);
    }
  }

  return {
    satisfied: missing.length === 0,
    missing,
  };
}

/**
 * Resolve dependencies for a capability, optionally auto-installing
 */
export async function resolveDeps(
  workspaceRoot: string,
  capabilityId: string,
  repoPath: string,
  autoInstall = false
): Promise<DepsResolveResult> {
  const manifest = await loadManifest(workspaceRoot);
  const installedIds = new Set(manifest.capabilities.map(c => c.id));

  // Try to find the capability in the repo or manifest
  let dependencies: string[] = [];

  // Check if it's already installed
  const installed = manifest.capabilities.find(c => c.id === capabilityId);
  if (installed) {
    dependencies = installed.dependencies || [];
  } else {
    // Try to read from repo's skill files
    // Look for skill files in common locations
    const skillPaths = [
      `skills/${capabilityId}.md`,
      `.claude/skills/${capabilityId}/SKILL.md`,
      `${capabilityId}.md`,
    ];

    for (const skillPath of skillPaths) {
      try {
        const content = await readFile(join(repoPath, skillPath), 'utf-8');
        const skill = parseSkillFile(content, skillPath);
        if (skill?.frontmatter) {
          dependencies = parseDependencies(skill.frontmatter);
          break;
        }
      } catch {
        // Try next path
      }
    }
  }

  // Find missing dependencies
  const missing: string[] = [];
  for (const dep of dependencies) {
    if (!installedIds.has(dep)) {
      missing.push(dep);
    }
  }

  // Build graph for topological sort
  const { graph, hasCycle } = buildDependencyGraph([
    ...manifest.capabilities,
    { id: capabilityId, dependencies } as Capability,
  ]);

  // Calculate install order
  const installOrder = topologicalSort(capabilityId, graph, installedIds);

  const result: DepsResolveResult = {
    capability: capabilityId,
    dependencies,
    missing,
    installOrder,
    hasCycle,
  };

  // Auto-install if requested
  if (autoInstall && missing.length > 0) {
    result.installed = [];
    result.failed = [];

    // Note: actual installation would require fetching and installing
    // For now, we just report what would need to be installed
    for (const dep of installOrder) {
      if (missing.includes(dep)) {
        // Would need to fetch and install
        result.failed.push(dep);
      }
    }

    if (result.failed.length === 0) {
      delete result.failed;
    }
    if (result.installed.length === 0) {
      delete result.installed;
    }
  }

  return result;
}

/**
 * Get dependencies for a capability from skill frontmatter
 */
export async function getDepsFromSkill(
  skillPath: string
): Promise<string[]> {
  try {
    const content = await readFile(skillPath, 'utf-8');
    const skill = parseSkillFile(content, skillPath);
    if (skill?.frontmatter) {
      return parseDependencies(skill.frontmatter);
    }
  } catch {
    // File doesn't exist or can't be read
  }
  return [];
}

/**
 * Register dependency tools
 */
export function registerDepsTools(server: McpServer): void {
  server.registerTool(
    'deps_check',
    {
      description: 'Check if a capability\'s dependencies are satisfied',
      inputSchema: {
        capabilityId: z.string().describe('ID of capability to check'),
        workspaceRoot: z.string().optional().describe('Workspace root (defaults to cwd)'),
      },
    },
    async ({ capabilityId, workspaceRoot }) => {
      try {
        const root = workspaceRoot || process.cwd();
        const result = await checkDeps(root, capabilityId);

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
    'deps_resolve',
    {
      description: 'Resolve dependencies for a capability and calculate install order',
      inputSchema: {
        capabilityId: z.string().describe('ID of capability'),
        repoPath: z.string().describe('Path to cloned repo containing capability'),
        autoInstall: z.boolean().optional().default(false).describe('Auto-install missing deps'),
        workspaceRoot: z.string().optional().describe('Workspace root (defaults to cwd)'),
      },
    },
    async ({ capabilityId, repoPath, autoInstall, workspaceRoot }) => {
      try {
        const root = workspaceRoot || process.cwd();
        const result = await resolveDeps(root, capabilityId, repoPath, autoInstall);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
          isError: result.hasCycle,
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
