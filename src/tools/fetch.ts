// repo_fetch tool - Phase 1
// Shallow clone repo, return commit hash and file list

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { simpleGit } from 'simple-git';
import { randomUUID } from 'crypto';
import { readdir, rm, mkdir } from 'fs/promises';
import { join } from 'path';
import type { FetchResult } from '../types.js';

const TMP_DIR = '.tmp';

// Track active clones for cleanup
const activeClones = new Map<string, string>();

async function listFilesRecursive(dir: string, base = ''): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const relativePath = base ? `${base}/${entry.name}` : entry.name;
    if (entry.name === '.git') continue;

    if (entry.isDirectory()) {
      files.push(...await listFilesRecursive(join(dir, entry.name), relativePath));
    } else {
      files.push(relativePath);
    }
  }
  return files;
}

async function ensureTmpDir(workspaceRoot: string): Promise<string> {
  const tmpPath = join(workspaceRoot, TMP_DIR);
  await mkdir(tmpPath, { recursive: true });
  return tmpPath;
}

export async function fetchRepo(
  url: string,
  branch?: string,
  workspaceRoot = process.cwd()
): Promise<FetchResult> {
  const tmpDir = await ensureTmpDir(workspaceRoot);
  const cloneId = randomUUID().slice(0, 8);
  const clonePath = join(tmpDir, cloneId);

  const git = simpleGit();

  // Shallow clone
  const cloneArgs = ['--depth', '1'];
  if (branch) {
    cloneArgs.push('--branch', branch);
  }

  await git.clone(url, clonePath, cloneArgs);

  // Get commit hash
  const localGit = simpleGit(clonePath);
  const log = await localGit.log({ maxCount: 1 });
  const commit = log.latest?.hash ?? 'unknown';

  // List files
  const files = await listFilesRecursive(clonePath);

  // Track for cleanup
  activeClones.set(cloneId, clonePath);

  return {
    path: clonePath,
    commit,
    files,
  };
}

export async function cleanupClone(cloneId: string): Promise<boolean> {
  const path = activeClones.get(cloneId);
  if (!path) return false;

  await rm(path, { recursive: true, force: true });
  activeClones.delete(cloneId);
  return true;
}

export async function cleanupAllClones(): Promise<number> {
  let count = 0;
  for (const [id, path] of activeClones) {
    await rm(path, { recursive: true, force: true });
    activeClones.delete(id);
    count++;
  }
  return count;
}

export function registerFetchTool(server: McpServer): void {
  // repo_fetch - shallow clone and return file list
  server.registerTool(
    'repo_fetch',
    {
      description: 'Shallow clone a GitHub repo and return its commit hash and file list',
      inputSchema: {
        url: z.string().describe('GitHub repository URL (https://github.com/owner/repo)'),
        branch: z.string().optional().describe('Branch to clone (defaults to default branch)'),
      },
    },
    async ({ url, branch }) => {
      try {
        const result = await fetchRepo(url, branch);
        const cloneId = result.path.split('/').pop() ?? '';

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                cloneId,
                path: result.path,
                commit: result.commit,
                fileCount: result.files.length,
                files: result.files.slice(0, 50),
                hasMore: result.files.length > 50,
              }, null, 2),
            },
          ],
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

  // repo_cleanup - remove cloned repo
  server.registerTool(
    'repo_cleanup',
    {
      description: 'Clean up a previously cloned repo',
      inputSchema: {
        cloneId: z.string().describe('Clone ID returned from repo_fetch'),
      },
    },
    async ({ cloneId }) => {
      const success = await cleanupClone(cloneId);
      return {
        content: [{
          type: 'text' as const,
          text: success ? `Cleaned up clone ${cloneId}` : `Clone ${cloneId} not found`,
        }],
      };
    }
  );
}
