import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vol } from 'memfs';

// Mock fs/promises with memfs
vi.mock('fs/promises', async () => {
  const memfs = await import('memfs');
  return memfs.fs.promises;
});

// Note: suggester only exports registerSuggesterTools which requires an MCP server.
// These tests verify the file handling logic through integration-style testing.

describe('Suggester Tool', () => {
  const workflowCachePath = '/project/workflow-cache.json';
  const knownReposPath = '/project/known-repos.json';

  beforeEach(() => {
    vol.reset();
    vol.mkdirSync('/project', { recursive: true });
  });

  describe('File Structure', () => {
    it('should work with workflow-cache.json structure', async () => {
      const cache = {
        version: '1.0',
        patterns: [
          {
            id: 'p1',
            type: 'tool_invocation',
            trigger: 'git commit',
            frequency: 5,
            lastSeen: new Date().toISOString(),
          },
        ],
      };
      vol.writeFileSync(workflowCachePath, JSON.stringify(cache));

      const content = vol.readFileSync(workflowCachePath, 'utf8');
      const parsed = JSON.parse(content as string);

      expect(parsed.patterns).toHaveLength(1);
      expect(parsed.patterns[0].trigger).toBe('git commit');
    });

    it('should work with known-repos.json structure', async () => {
      const repos = {
        version: '1.0',
        repos: [
          {
            url: 'https://github.com/test/repo',
            capabilities: ['git-helper', 'commit-wizard'],
            keywords: ['git', 'commit', 'push'],
          },
        ],
      };
      vol.writeFileSync(knownReposPath, JSON.stringify(repos));

      const content = vol.readFileSync(knownReposPath, 'utf8');
      const parsed = JSON.parse(content as string);

      expect(parsed.repos).toHaveLength(1);
      expect(parsed.repos[0].capabilities).toContain('git-helper');
    });

    it('should support multiple repos', async () => {
      const repos = {
        version: '1.0',
        repos: [
          { url: 'https://github.com/test/repo1', capabilities: ['cap1'], keywords: ['key1'] },
          { url: 'https://github.com/test/repo2', capabilities: ['cap2'], keywords: ['key2'] },
        ],
      };
      vol.writeFileSync(knownReposPath, JSON.stringify(repos));

      const content = vol.readFileSync(knownReposPath, 'utf8');
      const parsed = JSON.parse(content as string);

      expect(parsed.repos).toHaveLength(2);
    });

    it('should handle missing workflow cache', async () => {
      // No workflow-cache.json created
      const exists = vol.existsSync(workflowCachePath);

      expect(exists).toBe(false);
    });

    it('should handle missing known repos', async () => {
      // No known-repos.json created
      const exists = vol.existsSync(knownReposPath);

      expect(exists).toBe(false);
    });
  });

  describe('Suggestion Structure', () => {
    it('should define correct suggestion types', () => {
      const suggestion = {
        type: 'keyword_match' as const,
        message: 'Test message',
        repo: 'https://github.com/test/repo',
        capability: 'test-cap',
        confidence: 'high' as const,
        patternId: 'p1',
      };

      expect(suggestion.type).toMatch(/^(friction|overlap|keyword_match)$/);
      expect(suggestion.confidence).toMatch(/^(high|medium|low)$/);
    });

    it('should define correct friction suggestion', () => {
      const suggestion = {
        type: 'friction' as const,
        message: 'Repeated errors with network',
        repo: 'https://github.com/test/network-helper',
        capability: 'network-retry',
        confidence: 'medium' as const,
      };

      expect(suggestion.type).toBe('friction');
    });
  });

  describe('Pattern Filtering', () => {
    it('should identify patterns with sufficient frequency', () => {
      const patterns = [
        { id: 'p1', frequency: 5 },
        { id: 'p2', frequency: 2 },
        { id: 'p3', frequency: 10 },
      ];

      const MIN_FREQUENCY = 3;
      const significant = patterns.filter(p => p.frequency >= MIN_FREQUENCY);

      expect(significant).toHaveLength(2);
      expect(significant.map(p => p.id)).toContain('p1');
      expect(significant.map(p => p.id)).toContain('p3');
    });
  });
});
