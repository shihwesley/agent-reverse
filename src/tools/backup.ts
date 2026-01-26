// backup_* tools - Backup and restore AgentReverse configs
// Supports local files, GitHub Gist, and GitHub repos

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readFile, writeFile, readdir, mkdir, stat } from 'fs/promises';
import { join, dirname, relative } from 'path';
import { execSync } from 'child_process';
import { loadManifest, saveManifest } from './manifest.js';
import type {
  BackupManifest,
  BackupFile,
  BackupResult,
  RestoreResult,
  TargetAgent,
  Manifest,
} from '../types.js';

const VERSION = '1.1.0';

// Paths to backup per agent type
const BACKUP_PATHS: Record<TargetAgent, string[]> = {
  'claude-code': ['.claude/skills', '.claude/commands'],
  'cursor': ['.cursor/rules'],
  'antigravity': ['.agent/skills'],
  'custom': [],
};

const CONFIG_FILES = [
  'CLAUDE.md',
  'workflow-cache.json',
  'known-repos.json',
];

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function collectFiles(
  workspaceRoot: string,
  targetAgent: TargetAgent
): Promise<BackupFile[]> {
  const files: BackupFile[] = [];
  const paths = BACKUP_PATHS[targetAgent] || [];

  for (const basePath of paths) {
    const fullPath = join(workspaceRoot, basePath);
    if (!(await fileExists(fullPath))) continue;

    const entries = await readdir(fullPath, { withFileTypes: true, recursive: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;

      const filePath = join(entry.parentPath || fullPath, entry.name);
      const relativePath = relative(workspaceRoot, filePath);

      try {
        const content = await readFile(filePath, 'utf-8');
        const type = inferFileType(relativePath);
        files.push({ relativePath, content, type });
      } catch {
        // Skip unreadable files
      }
    }
  }

  return files;
}

function inferFileType(path: string): BackupFile['type'] {
  if (path.includes('/commands/')) return 'command';
  if (path.includes('/skills/')) return 'skill';
  if (path.includes('/rules/')) return 'rule';
  return 'config';
}

export async function createBackup(
  workspaceRoot: string,
  options: {
    outputPath?: string;
    gist?: boolean;
    gistPublic?: boolean;
    repo?: string;
  } = {}
): Promise<BackupResult> {
  const errors: string[] = [];
  const timestamp = new Date().toISOString();

  // Load manifest
  const manifest = await loadManifest(workspaceRoot);
  const targetAgent = manifest.targetAgent;

  // Collect files
  const files = await collectFiles(workspaceRoot, targetAgent);

  // Read optional config files
  let claudeMd: string | undefined;
  let observerCache: object | undefined;
  let knownRepos: string[] | undefined;

  try {
    claudeMd = await readFile(join(workspaceRoot, 'CLAUDE.md'), 'utf-8');
  } catch { /* optional */ }

  try {
    const cacheContent = await readFile(join(workspaceRoot, 'workflow-cache.json'), 'utf-8');
    observerCache = JSON.parse(cacheContent);
  } catch { /* optional */ }

  try {
    const reposContent = await readFile(join(workspaceRoot, 'known-repos.json'), 'utf-8');
    knownRepos = JSON.parse(reposContent);
  } catch { /* optional */ }

  // Build backup manifest
  const backup: BackupManifest = {
    version: VERSION,
    createdAt: timestamp,
    sourceAgent: targetAgent,
    manifest,
    files,
    claudeMd,
    observerCache,
    knownRepos,
  };

  const backupJson = JSON.stringify(backup, null, 2);
  const result: BackupResult = {
    success: true,
    fileCount: files.length,
    timestamp,
    errors,
  };

  // Output to file
  if (options.outputPath || (!options.gist && !options.repo)) {
    const outputPath = options.outputPath || `agent-reverse-backup-${timestamp.slice(0, 10)}.json`;
    const fullOutputPath = outputPath.startsWith('/') ? outputPath : join(workspaceRoot, outputPath);

    await mkdir(dirname(fullOutputPath), { recursive: true });
    await writeFile(fullOutputPath, backupJson, 'utf-8');
    result.backupPath = fullOutputPath;
  }

  // Upload to gist
  if (options.gist) {
    try {
      const visibility = options.gistPublic ? '--public' : '';
      const filename = `agent-reverse-backup-${timestamp.slice(0, 10)}.json`;

      // Write temp file for gist creation
      const tempPath = join(workspaceRoot, '.tmp', filename);
      await mkdir(dirname(tempPath), { recursive: true });
      await writeFile(tempPath, backupJson, 'utf-8');

      const output = execSync(
        `gh gist create ${visibility} --filename "${filename}" "${tempPath}"`,
        { encoding: 'utf-8', cwd: workspaceRoot }
      ).trim();

      result.gistUrl = output;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`Gist upload failed: ${msg}`);
      result.success = false;
    }
  }

  // Push to repo
  if (options.repo) {
    try {
      const filename = `backups/agent-reverse-backup-${timestamp.slice(0, 10)}.json`;

      // Clone repo to temp, add file, commit, push
      const tempDir = join(workspaceRoot, '.tmp', 'backup-repo');
      await mkdir(tempDir, { recursive: true });

      execSync(`gh repo clone ${options.repo} "${tempDir}" -- --depth 1`, {
        encoding: 'utf-8',
        cwd: workspaceRoot,
      });

      const backupDir = join(tempDir, 'backups');
      await mkdir(backupDir, { recursive: true });
      await writeFile(join(tempDir, filename), backupJson, 'utf-8');

      execSync('git add .', { cwd: tempDir });
      execSync(`git commit -m "AgentReverse backup ${timestamp}"`, { cwd: tempDir });
      execSync('git push', { cwd: tempDir });

      result.repoUrl = `https://github.com/${options.repo}/blob/main/${filename}`;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`Repo push failed: ${msg}`);
      result.success = false;
    }
  }

  return result;
}

export async function restoreBackup(
  workspaceRoot: string,
  backupSource: string,
  options: {
    targetAgent?: TargetAgent;
    merge?: boolean;
    force?: boolean;
    dryRun?: boolean;
  } = {}
): Promise<RestoreResult> {
  const errors: string[] = [];
  const filesRestored: string[] = [];
  const filesSkipped: string[] = [];

  // Load backup from file, gist, or URL
  let backupJson: string;

  try {
    if (backupSource.startsWith('http')) {
      // URL - could be gist or repo
      if (backupSource.includes('gist.github.com')) {
        // Gist URL - use gh gist view
        const gistId = backupSource.split('/').pop()!;
        backupJson = execSync(`gh gist view ${gistId} --raw`, {
          encoding: 'utf-8',
          cwd: workspaceRoot,
        });
      } else if (backupSource.includes('github.com')) {
        // Raw GitHub URL
        const rawUrl = backupSource
          .replace('github.com', 'raw.githubusercontent.com')
          .replace('/blob/', '/');
        backupJson = execSync(`curl -sL "${rawUrl}"`, { encoding: 'utf-8' });
      } else {
        backupJson = execSync(`curl -sL "${backupSource}"`, { encoding: 'utf-8' });
      }
    } else {
      // Local file
      const fullPath = backupSource.startsWith('/') ? backupSource : join(workspaceRoot, backupSource);
      backupJson = await readFile(fullPath, 'utf-8');
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      filesRestored: [],
      filesSkipped: [],
      converted: false,
      errors: [`Failed to load backup: ${msg}`],
    };
  }

  // Parse backup
  let backup: BackupManifest;
  try {
    backup = JSON.parse(backupJson);
  } catch {
    return {
      success: false,
      filesRestored: [],
      filesSkipped: [],
      converted: false,
      errors: ['Invalid backup format'],
    };
  }

  // Determine target agent
  const targetAgent = options.targetAgent || backup.sourceAgent;
  const converted = targetAgent !== backup.sourceAgent;

  if (options.dryRun) {
    // Just report what would be done
    const wouldRestore = backup.files.map(f => convertPath(f.relativePath, backup.sourceAgent, targetAgent));
    return {
      success: true,
      filesRestored: wouldRestore,
      filesSkipped: [],
      converted,
      errors: [],
    };
  }

  // Restore files
  for (const file of backup.files) {
    const targetPath = convertPath(file.relativePath, backup.sourceAgent, targetAgent);
    const fullPath = join(workspaceRoot, targetPath);

    // Check for existing file
    if (!options.force && await fileExists(fullPath)) {
      filesSkipped.push(targetPath);
      continue;
    }

    try {
      await mkdir(dirname(fullPath), { recursive: true });

      // Convert content if needed
      const content = converted
        ? convertContent(file.content, file.type, backup.sourceAgent, targetAgent)
        : file.content;

      await writeFile(fullPath, content, 'utf-8');
      filesRestored.push(targetPath);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`Failed to write ${targetPath}: ${msg}`);
    }
  }

  // Restore manifest
  if (options.merge) {
    // Merge capabilities
    const existingManifest = await loadManifest(workspaceRoot);
    const mergedCapabilities = [
      ...existingManifest.capabilities,
      ...backup.manifest.capabilities.filter(
        c => !existingManifest.capabilities.some(e => e.id === c.id)
      ),
    ];
    existingManifest.capabilities = mergedCapabilities;
    existingManifest.targetAgent = targetAgent;
    await saveManifest(workspaceRoot, existingManifest);
  } else {
    backup.manifest.targetAgent = targetAgent;
    await saveManifest(workspaceRoot, backup.manifest);
  }

  // Restore CLAUDE.md
  if (backup.claudeMd) {
    const claudeMdPath = join(workspaceRoot, 'CLAUDE.md');
    if (options.merge && await fileExists(claudeMdPath)) {
      // Append to existing
      const existing = await readFile(claudeMdPath, 'utf-8');
      if (!existing.includes('## AgentReverse Restored')) {
        await writeFile(claudeMdPath, existing + '\n\n## AgentReverse Restored\n\n' + backup.claudeMd, 'utf-8');
      }
    } else if (options.force || !await fileExists(claudeMdPath)) {
      await writeFile(claudeMdPath, backup.claudeMd, 'utf-8');
      filesRestored.push('CLAUDE.md');
    } else {
      filesSkipped.push('CLAUDE.md');
    }
  }

  // Restore caches
  if (backup.observerCache) {
    const cachePath = join(workspaceRoot, 'workflow-cache.json');
    if (options.force || !await fileExists(cachePath)) {
      await writeFile(cachePath, JSON.stringify(backup.observerCache, null, 2), 'utf-8');
      filesRestored.push('workflow-cache.json');
    }
  }

  if (backup.knownRepos) {
    const reposPath = join(workspaceRoot, 'known-repos.json');
    if (options.force || !await fileExists(reposPath)) {
      await writeFile(reposPath, JSON.stringify(backup.knownRepos, null, 2), 'utf-8');
      filesRestored.push('known-repos.json');
    }
  }

  return {
    success: errors.length === 0,
    filesRestored,
    filesSkipped,
    converted,
    errors,
  };
}

function convertPath(
  originalPath: string,
  fromAgent: TargetAgent,
  toAgent: TargetAgent
): string {
  if (fromAgent === toAgent) return originalPath;

  // Extract filename
  const filename = originalPath.split('/').pop()!;
  const baseName = filename.replace(/\.(md|mdc)$/, '');

  // Map to target agent paths
  const pathMappings: Record<TargetAgent, string> = {
    'claude-code': `.claude/skills/${baseName}.md`,
    'cursor': `.cursor/rules/${baseName}.mdc`,
    'antigravity': `.agent/skills/${baseName}/SKILL.md`,
    'custom': originalPath,
  };

  return pathMappings[toAgent] || originalPath;
}

function convertContent(
  content: string,
  type: BackupFile['type'],
  fromAgent: TargetAgent,
  toAgent: TargetAgent
): string {
  if (fromAgent === toAgent) return content;

  // For now, just return content as-is
  // Future: adapt frontmatter format between agents
  // Cursor uses .mdc (markdown components) format
  // Antigravity uses SKILL.md in subdirectories

  return content;
}

export async function listBackupContents(
  backupSource: string,
  workspaceRoot: string
): Promise<{ files: string[]; manifest: Manifest | null; version: string; sourceAgent: TargetAgent }> {
  let backupJson: string;

  if (backupSource.startsWith('http')) {
    if (backupSource.includes('gist.github.com')) {
      const gistId = backupSource.split('/').pop()!;
      backupJson = execSync(`gh gist view ${gistId} --raw`, { encoding: 'utf-8', cwd: workspaceRoot });
    } else {
      backupJson = execSync(`curl -sL "${backupSource}"`, { encoding: 'utf-8' });
    }
  } else {
    const fullPath = backupSource.startsWith('/') ? backupSource : join(workspaceRoot, backupSource);
    backupJson = await readFile(fullPath, 'utf-8');
  }

  const backup: BackupManifest = JSON.parse(backupJson);

  return {
    files: backup.files.map(f => f.relativePath),
    manifest: backup.manifest,
    version: backup.version,
    sourceAgent: backup.sourceAgent,
  };
}

export function registerBackupTools(server: McpServer): void {
  // backup_create - create backup archive
  server.registerTool(
    'backup_create',
    {
      description: 'Create backup of AgentReverse manifest, skills, and configs',
      inputSchema: {
        outputPath: z.string().optional().describe('Output file path (default: agent-reverse-backup-<date>.json)'),
        gist: z.boolean().optional().describe('Upload to GitHub Gist'),
        gistPublic: z.boolean().optional().describe('Make gist public (default: private)'),
        repo: z.string().optional().describe('Push to GitHub repo (owner/repo format)'),
      },
    },
    async ({ outputPath, gist, gistPublic, repo }) => {
      const workspaceRoot = process.cwd();
      const result = await createBackup(workspaceRoot, {
        outputPath,
        gist,
        gistPublic,
        repo,
      });

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        isError: !result.success,
      };
    }
  );

  // backup_restore - restore from backup
  server.registerTool(
    'backup_restore',
    {
      description: 'Restore capabilities from backup file, gist, or URL',
      inputSchema: {
        source: z.string().describe('Backup source: local path, gist URL, or repo URL'),
        targetAgent: z.enum(['claude-code', 'cursor', 'antigravity', 'custom']).optional()
          .describe('Target agent (for cross-agent restore)'),
        merge: z.boolean().optional().describe('Merge with existing (default: replace)'),
        force: z.boolean().optional().describe('Overwrite existing files'),
        dryRun: z.boolean().optional().describe('Preview changes without writing'),
      },
    },
    async ({ source, targetAgent, merge, force, dryRun }) => {
      const workspaceRoot = process.cwd();
      const result = await restoreBackup(workspaceRoot, source, {
        targetAgent: targetAgent as TargetAgent,
        merge,
        force,
        dryRun,
      });

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        isError: !result.success,
      };
    }
  );

  // backup_list - list backup contents
  server.registerTool(
    'backup_list',
    {
      description: 'List contents of a backup file without restoring',
      inputSchema: {
        source: z.string().describe('Backup source: local path, gist URL, or repo URL'),
      },
    },
    async ({ source }) => {
      const workspaceRoot = process.cwd();

      try {
        const contents = await listBackupContents(source, workspaceRoot);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(contents, null, 2) }],
          isError: false,
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: msg }) }],
          isError: true,
        };
      }
    }
  );
}
