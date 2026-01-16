// sync tools - Phase 2
// manifest_sync and manifest_check_updates

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { simpleGit } from 'simple-git';
import { loadManifest } from './manifest.js';
import { fetchRepo, cleanupClone } from './fetch.js';
import { installCapability } from './install.js';
import type { TargetAgent, Capability } from '../types.js';

// manifest_sync result types
interface SyncResult {
  installed: string[];
  failed: { id: string; error: string }[];
  skipped: string[];
}

// manifest_check_updates result types
interface UpdateInfo {
  id: string;
  source: string;
  pinnedCommit: string;
  latestCommit: string;
}

interface CheckUpdatesResult {
  outdated: UpdateInfo[];
  upToDate: string[];
  failed: { id: string; error: string }[];
}

export async function manifestSync(
  workspaceRoot: string,
  targetAgentOverride?: TargetAgent
): Promise<SyncResult> {
  const result: SyncResult = {
    installed: [],
    failed: [],
    skipped: [],
  };

  const manifest = await loadManifest(workspaceRoot);
  const targetAgent = targetAgentOverride ?? manifest.targetAgent;

  // Process each installed capability
  for (const capability of manifest.capabilities) {
    if (capability.status !== 'installed') {
      result.skipped.push(capability.id);
      continue;
    }

    try {
      // Fetch the repo
      const fetchResult = await fetchRepo(capability.source, undefined, workspaceRoot);
      const cloneId = fetchResult.path.split('/').pop() ?? '';

      try {
        // Reinstall the capability
        const installResult = await installCapability({
          skillPath: capability.extractedFrom,
          sourceRepoPath: fetchResult.path,
          sourceUrl: capability.source,
          commit: fetchResult.commit,
          capabilityId: capability.id,
          targetAgent,
          workspaceRoot,
        });

        if (installResult.success) {
          result.installed.push(capability.id);
        } else {
          result.failed.push({
            id: capability.id,
            error: installResult.errors.join('; '),
          });
        }
      } finally {
        // Always cleanup the clone
        await cleanupClone(cloneId);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.failed.push({ id: capability.id, error: message });
    }
  }

  // Add superseded capabilities to skipped
  for (const cap of manifest.superseded) {
    result.skipped.push(`${cap.id} (superseded)`);
  }

  return result;
}

export async function manifestCheckUpdates(
  workspaceRoot: string
): Promise<CheckUpdatesResult> {
  const result: CheckUpdatesResult = {
    outdated: [],
    upToDate: [],
    failed: [],
  };

  const manifest = await loadManifest(workspaceRoot);
  const git = simpleGit();

  for (const capability of manifest.capabilities) {
    if (capability.status !== 'installed') continue;

    try {
      // Use git ls-remote to get HEAD without cloning
      const remoteRefs = await git.listRemote(['--refs', capability.source, 'HEAD']);

      // Parse output: "<commit>\tHEAD"
      const match = remoteRefs.match(/^([a-f0-9]+)\s+HEAD/);
      if (!match) {
        result.failed.push({
          id: capability.id,
          error: 'Could not parse HEAD ref from remote',
        });
        continue;
      }

      const latestCommit = match[1];
      const pinnedCommit = capability.commit;

      if (latestCommit === pinnedCommit) {
        result.upToDate.push(capability.id);
      } else {
        result.outdated.push({
          id: capability.id,
          source: capability.source,
          pinnedCommit,
          latestCommit,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.failed.push({ id: capability.id, error: message });
    }
  }

  return result;
}

export function registerSyncTools(server: McpServer): void {
  // manifest_sync - reinstall all capabilities
  server.registerTool(
    'manifest_sync',
    {
      description: 'Reinstall all capabilities from the manifest to the target agent system',
      inputSchema: {
        workspaceRoot: z.string().optional().describe('Workspace root (defaults to cwd)'),
        targetAgent: z.enum(['claude-code', 'cursor', 'antigravity', 'custom'])
          .optional()
          .describe('Override target agent from manifest'),
      },
    },
    async ({ workspaceRoot, targetAgent }) => {
      const root = workspaceRoot || process.cwd();
      const result = await manifestSync(root, targetAgent as TargetAgent | undefined);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            installedCount: result.installed.length,
            failedCount: result.failed.length,
            skippedCount: result.skipped.length,
            installed: result.installed,
            failed: result.failed,
            skipped: result.skipped,
          }, null, 2),
        }],
        isError: result.failed.length > 0 && result.installed.length === 0,
      };
    }
  );

  // manifest_check_updates - compare pinned vs HEAD
  server.registerTool(
    'manifest_check_updates',
    {
      description: 'Check if any installed capabilities have updates available (pinned commit vs remote HEAD)',
      inputSchema: {
        workspaceRoot: z.string().optional().describe('Workspace root (defaults to cwd)'),
      },
    },
    async ({ workspaceRoot }) => {
      const root = workspaceRoot || process.cwd();
      const result = await manifestCheckUpdates(root);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            outdatedCount: result.outdated.length,
            upToDateCount: result.upToDate.length,
            failedCount: result.failed.length,
            outdated: result.outdated.map(u => ({
              id: u.id,
              source: u.source,
              pinned: u.pinnedCommit.slice(0, 7),
              latest: u.latestCommit.slice(0, 7),
            })),
            upToDate: result.upToDate,
            failed: result.failed,
          }, null, 2),
        }],
        isError: result.failed.length > 0 && result.outdated.length === 0 && result.upToDate.length === 0,
      };
    }
  );
}
