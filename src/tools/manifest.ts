// manifest_* tools - Phase 1
// CRUD operations on agent-reverse.json

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import type { Manifest, Capability, TargetAgent } from '../types.js';

const MANIFEST_FILE = 'agent-reverse.json';

function getDefaultManifest(targetAgent: TargetAgent = 'claude-code'): Manifest {
  return {
    version: '1.0',
    targetAgent,
    capabilities: [],
    superseded: [],
  };
}

export async function loadManifest(workspaceRoot: string): Promise<Manifest> {
  const manifestPath = join(workspaceRoot, MANIFEST_FILE);
  try {
    const content = await readFile(manifestPath, 'utf-8');
    return JSON.parse(content) as Manifest;
  } catch {
    return getDefaultManifest();
  }
}

export async function saveManifest(workspaceRoot: string, manifest: Manifest): Promise<void> {
  const manifestPath = join(workspaceRoot, MANIFEST_FILE);
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
}

export async function addCapability(
  workspaceRoot: string,
  capability: Capability
): Promise<{ success: boolean; message: string }> {
  const manifest = await loadManifest(workspaceRoot);

  // Check for existing capability with same ID
  const existing = manifest.capabilities.find(c => c.id === capability.id);
  if (existing) {
    // Check if same source+commit
    if (existing.source === capability.source && existing.commit === capability.commit) {
      return { success: false, message: `Capability '${capability.id}' already installed (same version)` };
    }
    // Different version - mark old as superseded
    manifest.superseded.push({ ...existing, status: 'superseded' });
    manifest.capabilities = manifest.capabilities.filter(c => c.id !== capability.id);
  }

  manifest.capabilities.push({
    ...capability,
    status: 'installed',
    installedAt: new Date().toISOString(),
  });

  await saveManifest(workspaceRoot, manifest);
  return { success: true, message: `Added capability '${capability.id}'` };
}

export async function removeCapability(
  workspaceRoot: string,
  id: string
): Promise<{ success: boolean; message: string; filesRemoved: string[] }> {
  const manifest = await loadManifest(workspaceRoot);

  const capability = manifest.capabilities.find(c => c.id === id);
  if (!capability) {
    return { success: false, message: `Capability '${id}' not found`, filesRemoved: [] };
  }

  manifest.capabilities = manifest.capabilities.filter(c => c.id !== id);
  await saveManifest(workspaceRoot, manifest);

  return {
    success: true,
    message: `Removed capability '${id}'`,
    filesRemoved: capability.files,
  };
}

export async function listCapabilities(workspaceRoot: string): Promise<Capability[]> {
  const manifest = await loadManifest(workspaceRoot);
  return manifest.capabilities;
}

export async function getCapability(workspaceRoot: string, id: string): Promise<Capability | null> {
  const manifest = await loadManifest(workspaceRoot);
  return manifest.capabilities.find(c => c.id === id) || null;
}

export function registerManifestTools(server: McpServer): void {
  // manifest_add - add capability to manifest
  server.registerTool(
    'manifest_add',
    {
      description: 'Add a capability to the agent-reverse manifest',
      inputSchema: {
        id: z.string().describe('Unique ID for the capability'),
        source: z.string().describe('GitHub URL of source repo'),
        commit: z.string().describe('Pinned commit hash'),
        files: z.array(z.string()).describe('List of installed file paths'),
        extractedFrom: z.string().describe('Source file in the repo'),
        dependencies: z.array(z.string()).optional().describe('Required capability IDs'),
        workspaceRoot: z.string().optional().describe('Workspace root (defaults to cwd)'),
      },
    },
    async ({ id, source, commit, files, extractedFrom, dependencies, workspaceRoot }) => {
      const root = workspaceRoot || process.cwd();
      const capability: Capability = {
        id,
        source,
        commit,
        files,
        extractedFrom,
        dependencies: dependencies || [],
        status: 'pending',
        installedAt: '',
      };

      const result = await addCapability(root, capability);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        }],
        isError: !result.success,
      };
    }
  );

  // manifest_remove - remove capability from manifest
  server.registerTool(
    'manifest_remove',
    {
      description: 'Remove a capability from the agent-reverse manifest',
      inputSchema: {
        id: z.string().describe('ID of capability to remove'),
        workspaceRoot: z.string().optional().describe('Workspace root (defaults to cwd)'),
      },
    },
    async ({ id, workspaceRoot }) => {
      const root = workspaceRoot || process.cwd();
      const result = await removeCapability(root, id);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        }],
        isError: !result.success,
      };
    }
  );

  // manifest_list - list all capabilities
  server.registerTool(
    'manifest_list',
    {
      description: 'List all capabilities in the agent-reverse manifest',
      inputSchema: {
        workspaceRoot: z.string().optional().describe('Workspace root (defaults to cwd)'),
      },
    },
    async ({ workspaceRoot }) => {
      const root = workspaceRoot || process.cwd();
      const manifest = await loadManifest(root);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            targetAgent: manifest.targetAgent,
            capabilityCount: manifest.capabilities.length,
            capabilities: manifest.capabilities.map(c => ({
              id: c.id,
              source: c.source,
              commit: c.commit.slice(0, 7),
              status: c.status,
              fileCount: c.files.length,
            })),
            supersededCount: manifest.superseded.length,
          }, null, 2),
        }],
      };
    }
  );

  // manifest_get - get specific capability
  server.registerTool(
    'manifest_get',
    {
      description: 'Get details of a specific capability',
      inputSchema: {
        id: z.string().describe('Capability ID'),
        workspaceRoot: z.string().optional().describe('Workspace root (defaults to cwd)'),
      },
    },
    async ({ id, workspaceRoot }) => {
      const root = workspaceRoot || process.cwd();
      const capability = await getCapability(root, id);

      if (!capability) {
        return {
          content: [{ type: 'text' as const, text: `Capability '${id}' not found` }],
          isError: true,
        };
      }

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(capability, null, 2),
        }],
      };
    }
  );
}
