import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vol } from 'memfs';
import {
  loadManifest,
  saveManifest,
  addCapability,
  removeCapability,
  listCapabilities,
  getCapability,
} from '../../../src/tools/manifest.js';
import { createMockCapability, createMockManifest } from '../../mocks/factories.js';

// Mock fs/promises with memfs
vi.mock('fs/promises', async () => {
  const memfs = await import('memfs');
  return memfs.fs.promises;
});

describe('Manifest Tool', () => {
  const manifestPath = '/project/agent-reverse.json';

  beforeEach(() => {
    vol.reset();
    vol.mkdirSync('/project', { recursive: true });
  });

  describe('loadManifest', () => {
    it('should load existing manifest', async () => {
      const manifest = createMockManifest({ version: '1.0' });
      vol.writeFileSync(manifestPath, JSON.stringify(manifest));

      const result = await loadManifest('/project');

      expect(result.version).toBe('1.0');
    });

    it('should return default manifest if file not exists', async () => {
      const result = await loadManifest('/project');

      expect(result.version).toBe('1.0');
      expect(result.capabilities).toEqual([]);
    });
  });

  describe('saveManifest', () => {
    it('should save manifest to file', async () => {
      const manifest = createMockManifest({ version: '2.0' });

      await saveManifest('/project', manifest);

      expect(vol.existsSync(manifestPath)).toBe(true);
      const saved = JSON.parse(vol.readFileSync(manifestPath, 'utf8') as string);
      expect(saved.version).toBe('2.0');
    });
  });

  describe('addCapability', () => {
    it('should create manifest if not exists', async () => {
      const capability = createMockCapability({ id: 'new-cap' });

      await addCapability('/project', capability);

      expect(vol.existsSync(manifestPath)).toBe(true);
    });

    it('should add capability to existing manifest', async () => {
      const existing = createMockManifest({ capabilities: [] });
      vol.writeFileSync(manifestPath, JSON.stringify(existing));

      const capability = createMockCapability({ id: 'new-cap' });
      const result = await addCapability('/project', capability);

      expect(result.success).toBe(true);
      const manifest = JSON.parse(vol.readFileSync(manifestPath, 'utf8') as string);
      expect(manifest.capabilities).toHaveLength(1);
      expect(manifest.capabilities[0].id).toBe('new-cap');
    });

    it('should reject duplicate capability with same version', async () => {
      const existing = createMockManifest({
        capabilities: [createMockCapability({ id: 'dup-cap', source: 'repo1', commit: 'abc123' })],
      });
      vol.writeFileSync(manifestPath, JSON.stringify(existing));

      const capability = createMockCapability({ id: 'dup-cap', source: 'repo1', commit: 'abc123' });
      const result = await addCapability('/project', capability);

      expect(result.success).toBe(false);
      expect(result.message).toContain('already installed');
    });

    it('should supersede old version when updating', async () => {
      const existing = createMockManifest({
        capabilities: [createMockCapability({ id: 'update-cap', commit: 'old123' })],
        superseded: [],
      });
      vol.writeFileSync(manifestPath, JSON.stringify(existing));

      const capability = createMockCapability({ id: 'update-cap', commit: 'new456' });
      const result = await addCapability('/project', capability);

      expect(result.success).toBe(true);
      const manifest = JSON.parse(vol.readFileSync(manifestPath, 'utf8') as string);
      expect(manifest.capabilities).toHaveLength(1);
      expect(manifest.capabilities[0].commit).toBe('new456');
      expect(manifest.superseded).toHaveLength(1);
    });
  });

  describe('removeCapability', () => {
    it('should remove capability by id', async () => {
      const existing = createMockManifest({
        capabilities: [
          createMockCapability({ id: 'cap-1' }),
          createMockCapability({ id: 'cap-2' }),
        ],
      });
      vol.writeFileSync(manifestPath, JSON.stringify(existing));

      const result = await removeCapability('/project', 'cap-1');

      expect(result.success).toBe(true);
      const manifest = JSON.parse(vol.readFileSync(manifestPath, 'utf8') as string);
      expect(manifest.capabilities).toHaveLength(1);
      expect(manifest.capabilities[0].id).toBe('cap-2');
    });

    it('should return files to remove', async () => {
      const existing = createMockManifest({
        capabilities: [createMockCapability({ id: 'cap-files', files: ['a.md', 'b.md'] })],
      });
      vol.writeFileSync(manifestPath, JSON.stringify(existing));

      const result = await removeCapability('/project', 'cap-files');

      expect(result.filesRemoved).toEqual(['a.md', 'b.md']);
    });

    it('should handle removing non-existent capability', async () => {
      const existing = createMockManifest({ capabilities: [] });
      vol.writeFileSync(manifestPath, JSON.stringify(existing));

      const result = await removeCapability('/project', 'nonexistent');

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });
  });

  describe('listCapabilities', () => {
    it('should return all capabilities', async () => {
      const existing = createMockManifest({
        capabilities: [
          createMockCapability({ id: 'cap-1' }),
          createMockCapability({ id: 'cap-2' }),
        ],
      });
      vol.writeFileSync(manifestPath, JSON.stringify(existing));

      const result = await listCapabilities('/project');

      expect(result).toHaveLength(2);
    });

    it('should return empty array if no manifest', async () => {
      const result = await listCapabilities('/project');

      expect(result).toEqual([]);
    });
  });

  describe('getCapability', () => {
    it('should return specific capability', async () => {
      const existing = createMockManifest({
        capabilities: [createMockCapability({ id: 'target', source: 'https://github.com/test/target' })],
      });
      vol.writeFileSync(manifestPath, JSON.stringify(existing));

      const result = await getCapability('/project', 'target');

      expect(result).not.toBeNull();
      expect(result!.source).toBe('https://github.com/test/target');
    });

    it('should return null for non-existent capability', async () => {
      const existing = createMockManifest({ capabilities: [] });
      vol.writeFileSync(manifestPath, JSON.stringify(existing));

      const result = await getCapability('/project', 'missing');

      expect(result).toBeNull();
    });
  });
});
