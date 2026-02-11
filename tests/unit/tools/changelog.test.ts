import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vol } from 'memfs';

vi.mock('fs/promises', async () => {
  const memfs = await import('memfs');
  return memfs.fs.promises;
});

vi.mock('child_process', () => ({
  execFile: vi.fn((_cmd: string, args: string[], _opts: unknown, cb: Function) => {
    if (args && args[0] === '--version') {
      cb(null, '2.1.40\n', '');
    } else {
      cb(null, '[]', '');
    }
  }),
}));

vi.mock('os', () => ({
  homedir: () => '/home/user',
}));

import { checkChangelog, matchMigrationRules } from '../../../src/tools/changelog.js';

describe('Changelog Awareness', () => {
  beforeEach(() => {
    vol.reset();
    vol.mkdirSync('/home/user/.claude', { recursive: true });
  });

  describe('matchMigrationRules', () => {
    it('should match static rules against changelog text', () => {
      const entries = [{
        version: '2.1.40',
        newFeatures: [],
        breakingChanges: ['deprecated allowedTools setting'],
        deprecations: [],
        bugFixes: [],
        configChanges: [],
      }];

      const result = matchMigrationRules(entries);
      expect(result.matched.length).toBeGreaterThan(0);
      expect(result.matched[0].rule.action).toBe('rename_setting');
    });

    it('should return unmatched entries for LLM fallback', () => {
      const entries = [{
        version: '2.1.40',
        newFeatures: ['added teleportation feature'],
        breakingChanges: [],
        deprecations: [],
        bugFixes: [],
        configChanges: [],
      }];

      const result = matchMigrationRules(entries);
      expect(result.unmatched).toContain('added teleportation feature');
    });

    it('should return empty arrays for empty changelog', () => {
      const result = matchMigrationRules([]);
      expect(result.matched).toHaveLength(0);
      expect(result.unmatched).toHaveLength(0);
    });
  });

  describe('checkChangelog', () => {
    it('should detect version change', async () => {
      vol.writeFileSync('/home/user/.claude/agent-reverse-local-state.json', JSON.stringify({
        version: '1.0',
        scannedAt: '2026-02-10T00:00:00Z',
        claudeCodeVersion: '2.1.39',
        fileHashes: {},
        state: { claudeCodeVersion: '2.1.39' },
      }));

      const result = await checkChangelog();
      expect(result.previousVersion).toBe('2.1.39');
      expect(result.currentVersion).toBe('2.1.40');
    });

    it('should return no-op when version unchanged', async () => {
      vol.writeFileSync('/home/user/.claude/agent-reverse-local-state.json', JSON.stringify({
        version: '1.0',
        scannedAt: '2026-02-10T00:00:00Z',
        claudeCodeVersion: '2.1.40',
        fileHashes: {},
        state: { claudeCodeVersion: '2.1.40' },
      }));

      const result = await checkChangelog();
      expect(result.previousVersion).toBe('2.1.40');
      expect(result.currentVersion).toBe('2.1.40');
      expect(result.entries).toHaveLength(0);
    });
  });
});
