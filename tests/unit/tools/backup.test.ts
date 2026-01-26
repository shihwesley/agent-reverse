import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vol } from 'memfs';
import {
  createBackup,
  restoreBackup,
  listBackupContents,
} from '../../../src/tools/backup.js';
import { createMockManifest, createMockCapability } from '../../mocks/factories.js';
import type { BackupManifest } from '../../../src/types.js';

// Mock fs/promises with memfs
vi.mock('fs/promises', async () => {
  const memfs = await import('memfs');
  return memfs.fs.promises;
});

// Mock child_process for gist/repo tests
vi.mock('child_process', () => ({
  execSync: vi.fn(),
}));

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
  });

  describe('listBackupContents', () => {
    it('should list files in backup', async () => {
      const backup: BackupManifest = {
        version: '1.0.1',
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
      expect(contents.version).toBe('1.0.1');
    });
  });
});
