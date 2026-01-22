import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vol } from 'memfs';
import { loadCache, saveCache, logEvent, getPatterns } from '../../../src/tools/observer.js';

// Mock fs/promises with memfs
vi.mock('fs/promises', async () => {
  const memfs = await import('memfs');
  return memfs.fs.promises;
});

describe('Observer Tool', () => {
  const cachePath = '/project/workflow-cache.json';

  beforeEach(() => {
    vol.reset();
    vol.mkdirSync('/project', { recursive: true });
  });

  describe('loadCache', () => {
    it('should load existing cache', async () => {
      const cache = {
        version: '1.0',
        patterns: [{ id: 'p1', type: 'tool_invocation', trigger: 'test', frequency: 5 }],
        lastPruned: new Date().toISOString(),
      };
      vol.writeFileSync(cachePath, JSON.stringify(cache));

      const result = await loadCache('/project');

      expect(result.patterns).toHaveLength(1);
      expect(result.patterns[0].frequency).toBe(5);
    });

    it('should return default cache if file not exists', async () => {
      const result = await loadCache('/project');

      expect(result.version).toBe('1.0');
      expect(result.patterns).toEqual([]);
    });
  });

  describe('saveCache', () => {
    it('should save cache to file', async () => {
      const cache = {
        version: '1.0',
        patterns: [],
        lastPruned: new Date().toISOString(),
      };

      await saveCache('/project', cache);

      expect(vol.existsSync(cachePath)).toBe(true);
    });

    it('should prune old patterns on save', async () => {
      const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(); // 60 days ago
      const recentDate = new Date().toISOString();
      const cache = {
        version: '1.0',
        patterns: [
          { id: 'old', type: 'tool_invocation' as const, trigger: 'old', frequency: 1, firstSeen: oldDate, lastSeen: oldDate, metadata: {} },
          { id: 'new', type: 'tool_invocation' as const, trigger: 'new', frequency: 1, firstSeen: recentDate, lastSeen: recentDate, metadata: {} },
        ],
        lastPruned: oldDate,
      };

      await saveCache('/project', cache);

      const saved = JSON.parse(vol.readFileSync(cachePath, 'utf8') as string);
      expect(saved.patterns).toHaveLength(1);
      expect(saved.patterns[0].id).toBe('new');
    });
  });

  describe('logEvent', () => {
    it('should create new pattern for first event', async () => {
      const result = await logEvent('/project', 'tool_invocation', 'repo_fetch');

      expect(result.type).toBe('tool_invocation');
      expect(result.trigger).toBe('repo_fetch');
      expect(result.frequency).toBe(1);
    });

    it('should increment frequency for existing pattern', async () => {
      // Log first event
      await logEvent('/project', 'tool_invocation', 'repo_fetch');

      // Log same event again
      const result = await logEvent('/project', 'tool_invocation', 'repo_fetch');

      expect(result.frequency).toBe(2);
    });

    it('should include metadata', async () => {
      const result = await logEvent('/project', 'error', 'network', { code: 500 });

      expect(result.metadata.code).toBe(500);
    });

    it('should save to cache file', async () => {
      await logEvent('/project', 'search', 'skills');

      expect(vol.existsSync(cachePath)).toBe(true);
      const cache = JSON.parse(vol.readFileSync(cachePath, 'utf8') as string);
      expect(cache.patterns).toHaveLength(1);
    });
  });

  describe('getPatterns', () => {
    beforeEach(async () => {
      const cache = {
        version: '1.0',
        patterns: [
          { id: 'p1', type: 'tool_invocation', trigger: 'fetch', frequency: 10, firstSeen: new Date().toISOString(), lastSeen: new Date().toISOString(), metadata: {} },
          { id: 'p2', type: 'tool_invocation', trigger: 'analyze', frequency: 2, firstSeen: new Date().toISOString(), lastSeen: new Date().toISOString(), metadata: {} },
          { id: 'p3', type: 'error', trigger: 'network', frequency: 5, firstSeen: new Date().toISOString(), lastSeen: new Date().toISOString(), metadata: {} },
        ],
        lastPruned: new Date().toISOString(),
      };
      vol.writeFileSync(cachePath, JSON.stringify(cache));
    });

    it('should return all patterns', async () => {
      const result = await getPatterns('/project');

      expect(result).toHaveLength(3);
    });

    it('should filter by type', async () => {
      const result = await getPatterns('/project', 'error');

      expect(result).toHaveLength(1);
      expect(result[0].trigger).toBe('network');
    });

    it('should filter by minimum frequency', async () => {
      const result = await getPatterns('/project', undefined, 5);

      expect(result).toHaveLength(2);
      expect(result.every(p => p.frequency >= 5)).toBe(true);
    });

    it('should return empty array for empty cache', async () => {
      vol.reset();
      vol.mkdirSync('/project', { recursive: true });

      const result = await getPatterns('/project');

      expect(result).toEqual([]);
    });
  });
});
