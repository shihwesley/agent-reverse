import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vol } from 'memfs';
import { createMockManifest, createMockCapability } from '../../mocks/factories.js';

// Mock fs/promises with memfs
vi.mock('fs/promises', async () => {
  const memfs = await import('memfs');
  return memfs.fs.promises;
});

// Mock fetch tool
vi.mock('../../../src/tools/fetch.js', () => ({
  fetchRepo: vi.fn().mockResolvedValue({
    path: '/tmp/clone-123',
    commit: 'newcommit456',
    files: ['skill.md'],
  }),
  cleanupClone: vi.fn().mockResolvedValue(true),
}));

// Mock install tool
vi.mock('../../../src/tools/install.js', () => ({
  installCapability: vi.fn().mockResolvedValue({
    success: true,
    capabilityId: 'test-cap',
    filesWritten: ['.claude/skills/test.md'],
    configUpdated: true,
    manifestUpdated: true,
    errors: [],
  }),
}));

// Mock simple-git for checkUpdates
const mockGit = {
  listRemote: vi.fn().mockResolvedValue('abc123\tHEAD'),
};
vi.mock('simple-git', () => ({
  simpleGit: vi.fn(() => mockGit),
}));

import { manifestSync, manifestCheckUpdates } from '../../../src/tools/sync.js';
import { fetchRepo, cleanupClone } from '../../../src/tools/fetch.js';
import { installCapability } from '../../../src/tools/install.js';

describe('Sync Tool', () => {
  beforeEach(() => {
    vol.reset();
    vol.mkdirSync('/project', { recursive: true });
    vi.clearAllMocks();
  });

  describe('manifestSync', () => {
    it('should reinstall all installed capabilities', async () => {
      const manifest = createMockManifest({
        capabilities: [
          createMockCapability({ id: 'cap-1', status: 'installed', source: 'https://github.com/test/repo1' }),
          createMockCapability({ id: 'cap-2', status: 'installed', source: 'https://github.com/test/repo2' }),
        ],
      });
      vol.writeFileSync('/project/agent-reverse.json', JSON.stringify(manifest));

      const result = await manifestSync('/project');

      expect(result.installed).toHaveLength(2);
      expect(fetchRepo).toHaveBeenCalledTimes(2);
    });

    it('should skip non-installed capabilities', async () => {
      const manifest = createMockManifest({
        capabilities: [
          createMockCapability({ id: 'pending-cap', status: 'pending' }),
        ],
      });
      vol.writeFileSync('/project/agent-reverse.json', JSON.stringify(manifest));

      const result = await manifestSync('/project');

      expect(result.skipped).toContain('pending-cap');
      expect(fetchRepo).not.toHaveBeenCalled();
    });

    it('should report failed syncs', async () => {
      vi.mocked(installCapability).mockResolvedValueOnce({
        success: false,
        capabilityId: 'fail-cap',
        filesWritten: [],
        configUpdated: false,
        manifestUpdated: false,
        errors: ['Install failed'],
      });

      const manifest = createMockManifest({
        capabilities: [
          createMockCapability({ id: 'fail-cap', status: 'installed' }),
        ],
      });
      vol.writeFileSync('/project/agent-reverse.json', JSON.stringify(manifest));

      const result = await manifestSync('/project');

      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].id).toBe('fail-cap');
    });

    it('should cleanup clones after sync', async () => {
      const manifest = createMockManifest({
        capabilities: [
          createMockCapability({ id: 'cleanup-cap', status: 'installed' }),
        ],
      });
      vol.writeFileSync('/project/agent-reverse.json', JSON.stringify(manifest));

      await manifestSync('/project');

      expect(cleanupClone).toHaveBeenCalled();
    });

    it('should handle empty manifest', async () => {
      const manifest = createMockManifest({ capabilities: [] });
      vol.writeFileSync('/project/agent-reverse.json', JSON.stringify(manifest));

      const result = await manifestSync('/project');

      expect(result.installed).toHaveLength(0);
      expect(result.failed).toHaveLength(0);
    });

    it('should include superseded in skipped', async () => {
      const manifest = createMockManifest({
        capabilities: [],
        superseded: [createMockCapability({ id: 'old-cap', status: 'superseded' })],
      });
      vol.writeFileSync('/project/agent-reverse.json', JSON.stringify(manifest));

      const result = await manifestSync('/project');

      expect(result.skipped.some(s => s.includes('old-cap'))).toBe(true);
    });
  });

  describe('manifestCheckUpdates', () => {
    it('should return result with correct structure', async () => {
      const manifest = createMockManifest({
        capabilities: [
          createMockCapability({ id: 'test-cap', commit: 'abc123', source: 'https://github.com/test/repo' }),
        ],
      });
      vol.writeFileSync('/project/agent-reverse.json', JSON.stringify(manifest));

      const result = await manifestCheckUpdates('/project');

      // Verify result structure
      expect(result).toHaveProperty('outdated');
      expect(result).toHaveProperty('upToDate');
      expect(result).toHaveProperty('failed');
      expect(Array.isArray(result.outdated)).toBe(true);
      expect(Array.isArray(result.upToDate)).toBe(true);
      expect(Array.isArray(result.failed)).toBe(true);
    });

    it('should handle empty manifest', async () => {
      const manifest = createMockManifest({ capabilities: [] });
      vol.writeFileSync('/project/agent-reverse.json', JSON.stringify(manifest));

      const result = await manifestCheckUpdates('/project');

      expect(result.outdated).toHaveLength(0);
      expect(result.upToDate).toHaveLength(0);
      expect(result.failed).toHaveLength(0);
    });
  });
});
