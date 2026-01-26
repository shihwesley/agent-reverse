import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vol } from 'memfs';
import {
  createBackup,
  restoreBackup,
  listBackupContents,
} from '../../../src/tools/backup.js';
import { createMockManifest, createMockCapability } from '../../mocks/factories.js';
import type { BackupManifest } from '../../../src/types.js';
import { execSync } from 'child_process';

// Mock fs/promises with memfs
vi.mock('fs/promises', async () => {
  const memfs = await import('memfs');
  return memfs.fs.promises;
});

// Mock child_process for gist/repo tests
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

const mockExecSync = vi.mocked(execSync);

describe('Backup Tool', () => {
  const manifestPath = '/project/agent-reverse.json';
  const skillsDir = '/project/.claude/skills';
  const commandsDir = '/project/.claude/commands';

  beforeEach(() => {
    vol.reset();
    vol.mkdirSync('/project', { recursive: true });
  });

  describe('createBackup', () => {
    it('should create backup with manifest only', async () => {
      const manifest = createMockManifest({ capabilities: [] });
      vol.writeFileSync(manifestPath, JSON.stringify(manifest));

      const result = await createBackup('/project');

      expect(result.success).toBe(true);
      expect(result.fileCount).toBe(0);
      expect(result.backupPath).toContain('agent-reverse-backup');
    });

    it('should include skills in backup', async () => {
      const manifest = createMockManifest({
        capabilities: [createMockCapability({ id: 'test-skill' })],
      });
      vol.writeFileSync(manifestPath, JSON.stringify(manifest));

      vol.mkdirSync(skillsDir, { recursive: true });
      vol.writeFileSync(`${skillsDir}/test-skill.md`, '# Test Skill\n\nContent here');

      const result = await createBackup('/project');

      expect(result.success).toBe(true);
      expect(result.fileCount).toBe(1);

      // Verify backup file contents
      const backupContent = vol.readFileSync(result.backupPath!, 'utf8') as string;
      const backup: BackupManifest = JSON.parse(backupContent);
      expect(backup.files).toHaveLength(1);
      expect(backup.files[0].relativePath).toBe('.claude/skills/test-skill.md');
    });

    it('should include CLAUDE.md in backup', async () => {
      const manifest = createMockManifest({ capabilities: [] });
      vol.writeFileSync(manifestPath, JSON.stringify(manifest));
      vol.writeFileSync('/project/CLAUDE.md', '# Project Docs');

      const result = await createBackup('/project');

      expect(result.success).toBe(true);
      const backupContent = vol.readFileSync(result.backupPath!, 'utf8') as string;
      const backup: BackupManifest = JSON.parse(backupContent);
      expect(backup.claudeMd).toBe('# Project Docs');
    });

    it('should include commands directory', async () => {
      const manifest = createMockManifest({ capabilities: [] });
      vol.writeFileSync(manifestPath, JSON.stringify(manifest));

      vol.mkdirSync(commandsDir, { recursive: true });
      vol.writeFileSync(`${commandsDir}/my-command.md`, '# Command');

      const result = await createBackup('/project');

      expect(result.success).toBe(true);
      expect(result.fileCount).toBe(1);

      const backupContent = vol.readFileSync(result.backupPath!, 'utf8') as string;
      const backup: BackupManifest = JSON.parse(backupContent);
      expect(backup.files[0].type).toBe('command');
    });

    it('should use custom output path', async () => {
      const manifest = createMockManifest({ capabilities: [] });
      vol.writeFileSync(manifestPath, JSON.stringify(manifest));

      const result = await createBackup('/project', { outputPath: 'my-backup.json' });

      expect(result.success).toBe(true);
      expect(result.backupPath).toBe('/project/my-backup.json');
    });
  });

  describe('restoreBackup', () => {
    it('should restore backup to same agent', async () => {
      // Create backup file
      const backup: BackupManifest = {
        version: '1.0.1',
        createdAt: new Date().toISOString(),
        sourceAgent: 'claude-code',
        manifest: createMockManifest({ capabilities: [] }),
        files: [
          {
            relativePath: '.claude/skills/restored-skill.md',
            content: '# Restored',
            type: 'skill',
          },
        ],
      };
      vol.writeFileSync('/project/backup.json', JSON.stringify(backup));

      const result = await restoreBackup('/project', 'backup.json');

      expect(result.success).toBe(true);
      expect(result.filesRestored).toContain('.claude/skills/restored-skill.md');
      expect(vol.existsSync('/project/.claude/skills/restored-skill.md')).toBe(true);
    });

    it('should skip existing files without --force', async () => {
      const backup: BackupManifest = {
        version: '1.0.1',
        createdAt: new Date().toISOString(),
        sourceAgent: 'claude-code',
        manifest: createMockManifest({ capabilities: [] }),
        files: [
          {
            relativePath: '.claude/skills/existing.md',
            content: '# New Content',
            type: 'skill',
          },
        ],
      };
      vol.writeFileSync('/project/backup.json', JSON.stringify(backup));

      // Create existing file
      vol.mkdirSync('/project/.claude/skills', { recursive: true });
      vol.writeFileSync('/project/.claude/skills/existing.md', '# Old Content');

      const result = await restoreBackup('/project', 'backup.json');

      expect(result.success).toBe(true);
      expect(result.filesSkipped).toContain('.claude/skills/existing.md');
      expect(vol.readFileSync('/project/.claude/skills/existing.md', 'utf8')).toBe('# Old Content');
    });

    it('should overwrite with --force', async () => {
      const backup: BackupManifest = {
        version: '1.0.1',
        createdAt: new Date().toISOString(),
        sourceAgent: 'claude-code',
        manifest: createMockManifest({ capabilities: [] }),
        files: [
          {
            relativePath: '.claude/skills/existing.md',
            content: '# New Content',
            type: 'skill',
          },
        ],
      };
      vol.writeFileSync('/project/backup.json', JSON.stringify(backup));

      vol.mkdirSync('/project/.claude/skills', { recursive: true });
      vol.writeFileSync('/project/.claude/skills/existing.md', '# Old Content');

      const result = await restoreBackup('/project', 'backup.json', { force: true });

      expect(result.success).toBe(true);
      expect(result.filesRestored).toContain('.claude/skills/existing.md');
      expect(vol.readFileSync('/project/.claude/skills/existing.md', 'utf8')).toBe('# New Content');
    });

    it('should support dry-run mode', async () => {
      const backup: BackupManifest = {
        version: '1.0.1',
        createdAt: new Date().toISOString(),
        sourceAgent: 'claude-code',
        manifest: createMockManifest({ capabilities: [] }),
        files: [
          {
            relativePath: '.claude/skills/test.md',
            content: '# Test',
            type: 'skill',
          },
        ],
      };
      vol.writeFileSync('/project/backup.json', JSON.stringify(backup));

      const result = await restoreBackup('/project', 'backup.json', { dryRun: true });

      expect(result.success).toBe(true);
      expect(result.filesRestored).toHaveLength(1);
      // File should NOT actually be created
      expect(vol.existsSync('/project/.claude/skills/test.md')).toBe(false);
    });

    it('should merge manifests with --merge', async () => {
      // Existing manifest with one capability
      const existing = createMockManifest({
        capabilities: [createMockCapability({ id: 'existing-cap' })],
      });
      vol.writeFileSync(manifestPath, JSON.stringify(existing));

      // Backup with different capability
      const backup: BackupManifest = {
        version: '1.0.1',
        createdAt: new Date().toISOString(),
        sourceAgent: 'claude-code',
        manifest: createMockManifest({
          capabilities: [createMockCapability({ id: 'backup-cap' })],
        }),
        files: [],
      };
      vol.writeFileSync('/project/backup.json', JSON.stringify(backup));

      const result = await restoreBackup('/project', 'backup.json', { merge: true });

      expect(result.success).toBe(true);
      const merged = JSON.parse(vol.readFileSync(manifestPath, 'utf8') as string);
      expect(merged.capabilities).toHaveLength(2);
      expect(merged.capabilities.map((c: { id: string }) => c.id)).toContain('existing-cap');
      expect(merged.capabilities.map((c: { id: string }) => c.id)).toContain('backup-cap');
    });

    it('should convert paths for cross-agent restore', async () => {
      const backup: BackupManifest = {
        version: '1.0.1',
        createdAt: new Date().toISOString(),
        sourceAgent: 'claude-code',
        manifest: createMockManifest({ targetAgent: 'claude-code', capabilities: [] }),
        files: [
          {
            relativePath: '.claude/skills/my-skill.md',
            content: '# Skill',
            type: 'skill',
          },
        ],
      };
      vol.writeFileSync('/project/backup.json', JSON.stringify(backup));

      const result = await restoreBackup('/project', 'backup.json', { targetAgent: 'cursor' });

      expect(result.success).toBe(true);
      expect(result.converted).toBe(true);
      expect(result.filesRestored).toContain('.cursor/rules/my-skill.mdc');
    });

    it('should convert paths for antigravity restore', async () => {
      const backup: BackupManifest = {
        version: '1.1.0',
        createdAt: new Date().toISOString(),
        sourceAgent: 'claude-code',
        manifest: createMockManifest({ targetAgent: 'claude-code', capabilities: [] }),
        files: [
          {
            relativePath: '.claude/skills/my-skill.md',
            content: '# Skill',
            type: 'skill',
          },
        ],
      };
      vol.writeFileSync('/project/backup.json', JSON.stringify(backup));

      const result = await restoreBackup('/project', 'backup.json', { targetAgent: 'antigravity' });

      expect(result.success).toBe(true);
      expect(result.converted).toBe(true);
      expect(result.filesRestored).toContain('.agent/skills/my-skill/SKILL.md');
    });

    it('should restore observer cache and known repos', async () => {
      const backup: BackupManifest = {
        version: '1.1.0',
        createdAt: new Date().toISOString(),
        sourceAgent: 'claude-code',
        manifest: createMockManifest({ capabilities: [] }),
        files: [],
        observerCache: { patterns: ['test'] },
        knownRepos: ['https://github.com/test/repo'],
      };
      vol.writeFileSync('/project/backup.json', JSON.stringify(backup));

      const result = await restoreBackup('/project', 'backup.json', { force: true });

      expect(result.success).toBe(true);
      expect(vol.existsSync('/project/workflow-cache.json')).toBe(true);
      expect(vol.existsSync('/project/known-repos.json')).toBe(true);
    });

    it('should handle invalid backup format', async () => {
      vol.writeFileSync('/project/invalid.json', 'not json');

      const result = await restoreBackup('/project', 'invalid.json');

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Invalid backup format');
    });

    it('should handle missing backup file', async () => {
      const result = await restoreBackup('/project', 'nonexistent.json');

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Failed to load backup');
    });

    it('should restore CLAUDE.md with merge', async () => {
      vol.writeFileSync('/project/CLAUDE.md', '# Existing');
      const backup: BackupManifest = {
        version: '1.1.0',
        createdAt: new Date().toISOString(),
        sourceAgent: 'claude-code',
        manifest: createMockManifest({ capabilities: [] }),
        files: [],
        claudeMd: '# Backup Content',
      };
      vol.writeFileSync('/project/backup.json', JSON.stringify(backup));

      await restoreBackup('/project', 'backup.json', { merge: true });

      const content = vol.readFileSync('/project/CLAUDE.md', 'utf8') as string;
      expect(content).toContain('# Existing');
      expect(content).toContain('AgentReverse Restored');
    });
  });

  describe('createBackup with gist', () => {
    beforeEach(() => {
      mockExecSync.mockReset();
    });

    it('should upload to gist when --gist flag is set', async () => {
      const manifest = createMockManifest({ capabilities: [] });
      vol.writeFileSync(manifestPath, JSON.stringify(manifest));
      mockExecSync.mockReturnValue('https://gist.github.com/user/abc123');

      const result = await createBackup('/project', { gist: true });

      expect(result.success).toBe(true);
      expect(result.gistUrl).toBe('https://gist.github.com/user/abc123');
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('gh gist create'),
        expect.any(Object)
      );
    });

    it('should handle gist upload failure', async () => {
      const manifest = createMockManifest({ capabilities: [] });
      vol.writeFileSync(manifestPath, JSON.stringify(manifest));
      mockExecSync.mockImplementation(() => {
        throw new Error('gh: not authenticated');
      });

      const result = await createBackup('/project', { gist: true });

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Gist upload failed');
    });

    it('should create public gist with --gistPublic', async () => {
      const manifest = createMockManifest({ capabilities: [] });
      vol.writeFileSync(manifestPath, JSON.stringify(manifest));
      mockExecSync.mockReturnValue('https://gist.github.com/user/public123');

      const result = await createBackup('/project', { gist: true, gistPublic: true });

      expect(result.success).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('--public'),
        expect.any(Object)
      );
    });
  });

  describe('createBackup with repo', () => {
    beforeEach(() => {
      mockExecSync.mockReset();
    });

    it('should push to repo when --repo flag is set', async () => {
      const manifest = createMockManifest({ capabilities: [] });
      vol.writeFileSync(manifestPath, JSON.stringify(manifest));
      mockExecSync.mockReturnValue('');

      const result = await createBackup('/project', { repo: 'user/backups' });

      expect(result.success).toBe(true);
      expect(result.repoUrl).toContain('github.com/user/backups');
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('gh repo clone'),
        expect.any(Object)
      );
    });

    it('should handle repo push failure', async () => {
      const manifest = createMockManifest({ capabilities: [] });
      vol.writeFileSync(manifestPath, JSON.stringify(manifest));
      mockExecSync.mockImplementation(() => {
        throw new Error('Repository not found');
      });

      const result = await createBackup('/project', { repo: 'user/nonexistent' });

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Repo push failed');
    });
  });

  describe('restoreBackup from URL', () => {
    beforeEach(() => {
      mockExecSync.mockReset();
    });

    it('should restore from gist URL', async () => {
      const backup: BackupManifest = {
        version: '1.1.0',
        createdAt: new Date().toISOString(),
        sourceAgent: 'claude-code',
        manifest: createMockManifest({ capabilities: [] }),
        files: [{ relativePath: '.claude/skills/test.md', content: '# Test', type: 'skill' }],
      };
      mockExecSync.mockReturnValue(JSON.stringify(backup));

      const result = await restoreBackup('/project', 'https://gist.github.com/user/abc123');

      expect(result.success).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('gh gist view'),
        expect.any(Object)
      );
    });

    it('should restore from GitHub repo URL', async () => {
      const backup: BackupManifest = {
        version: '1.1.0',
        createdAt: new Date().toISOString(),
        sourceAgent: 'claude-code',
        manifest: createMockManifest({ capabilities: [] }),
        files: [],
      };
      mockExecSync.mockReturnValue(JSON.stringify(backup));

      const result = await restoreBackup('/project', 'https://github.com/user/repo/blob/main/backup.json');

      expect(result.success).toBe(true);
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('curl'),
        expect.any(Object)
      );
    });
  });

  describe('listBackupContents', () => {
    it('should list files in backup', async () => {
      const backup: BackupManifest = {
        version: '1.1.0',
        createdAt: new Date().toISOString(),
        sourceAgent: 'claude-code',
        manifest: createMockManifest({ capabilities: [] }),
        files: [
          { relativePath: '.claude/skills/a.md', content: '', type: 'skill' },
          { relativePath: '.claude/skills/b.md', content: '', type: 'skill' },
        ],
      };
      vol.writeFileSync('/project/backup.json', JSON.stringify(backup));

      const contents = await listBackupContents('backup.json', '/project');

      expect(contents.files).toHaveLength(2);
      expect(contents.sourceAgent).toBe('claude-code');
      expect(contents.version).toBe('1.1.0');
    });

    it('should list backup from gist URL', async () => {
      const backup: BackupManifest = {
        version: '1.1.0',
        createdAt: new Date().toISOString(),
        sourceAgent: 'cursor',
        manifest: createMockManifest({ targetAgent: 'cursor', capabilities: [] }),
        files: [{ relativePath: '.cursor/rules/test.mdc', content: '', type: 'rule' }],
      };
      mockExecSync.mockReturnValue(JSON.stringify(backup));

      const contents = await listBackupContents('https://gist.github.com/user/xyz', '/project');

      expect(contents.files).toHaveLength(1);
      expect(contents.sourceAgent).toBe('cursor');
    });
  });

  describe('edge cases', () => {
    it('should handle absolute output path', async () => {
      const manifest = createMockManifest({ capabilities: [] });
      vol.writeFileSync(manifestPath, JSON.stringify(manifest));
      vol.mkdirSync('/backups', { recursive: true });

      const result = await createBackup('/project', { outputPath: '/backups/my-backup.json' });

      expect(result.success).toBe(true);
      expect(result.backupPath).toBe('/backups/my-backup.json');
    });

    it('should backup workflow-cache.json if exists', async () => {
      const manifest = createMockManifest({ capabilities: [] });
      vol.writeFileSync(manifestPath, JSON.stringify(manifest));
      vol.writeFileSync('/project/workflow-cache.json', JSON.stringify({ patterns: ['test'] }));

      const result = await createBackup('/project');

      expect(result.success).toBe(true);
      const backupContent = vol.readFileSync(result.backupPath!, 'utf8') as string;
      const backup: BackupManifest = JSON.parse(backupContent);
      expect(backup.observerCache).toEqual({ patterns: ['test'] });
    });

    it('should backup known-repos.json if exists', async () => {
      const manifest = createMockManifest({ capabilities: [] });
      vol.writeFileSync(manifestPath, JSON.stringify(manifest));
      vol.writeFileSync('/project/known-repos.json', JSON.stringify(['repo1', 'repo2']));

      const result = await createBackup('/project');

      expect(result.success).toBe(true);
      const backupContent = vol.readFileSync(result.backupPath!, 'utf8') as string;
      const backup: BackupManifest = JSON.parse(backupContent);
      expect(backup.knownRepos).toEqual(['repo1', 'repo2']);
    });

    it('should handle cursor agent backup', async () => {
      const manifest = createMockManifest({ targetAgent: 'cursor', capabilities: [] });
      vol.writeFileSync(manifestPath, JSON.stringify(manifest));
      vol.mkdirSync('/project/.cursor/rules', { recursive: true });
      vol.writeFileSync('/project/.cursor/rules/test.mdc', '# Rule');

      const result = await createBackup('/project');

      expect(result.success).toBe(true);
      expect(result.fileCount).toBe(1);
    });
  });
});
