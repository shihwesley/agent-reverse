import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vol } from 'memfs';

// Mock fs/promises with memfs
vi.mock('fs/promises', async () => {
  const memfs = await import('memfs');
  return memfs.fs.promises;
});

// Import after mocking
import {
  loadCache,
  loadUserRepos,
  saveUserRepos,
  generateSuggestions,
  type WorkflowCache,
  type KnownRepo,
} from '../../../src/tools/suggester.js';

describe('Suggester Tool', () => {
  beforeEach(() => {
    vol.reset();
    vol.mkdirSync('/project', { recursive: true });
  });

  describe('loadCache', () => {
    it('should load workflow cache from file', async () => {
      const cache: WorkflowCache = {
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
      vol.writeFileSync('/project/workflow-cache.json', JSON.stringify(cache));

      const result = await loadCache('/project');

      expect(result.patterns).toHaveLength(1);
      expect(result.patterns[0].trigger).toBe('git commit');
      expect(result.patterns[0].frequency).toBe(5);
    });

    it('should return empty cache when file missing', async () => {
      const result = await loadCache('/project');

      expect(result.version).toBe('1.0');
      expect(result.patterns).toHaveLength(0);
    });

    it('should return empty cache on invalid JSON', async () => {
      vol.writeFileSync('/project/workflow-cache.json', 'not valid json');

      const result = await loadCache('/project');

      expect(result.patterns).toHaveLength(0);
    });
  });

  describe('loadUserRepos', () => {
    it('should load user repos from file', async () => {
      const repos = {
        version: '1.0',
        repos: [
          {
            url: 'https://github.com/test/repo',
            capabilities: ['git-helper'],
            keywords: ['git', 'commit'],
          },
        ],
      };
      vol.writeFileSync('/project/known-repos.json', JSON.stringify(repos));

      const result = await loadUserRepos('/project');

      expect(result).toHaveLength(1);
      expect(result[0].url).toBe('https://github.com/test/repo');
      expect(result[0].capabilities).toContain('git-helper');
    });

    it('should return empty array when file missing', async () => {
      const result = await loadUserRepos('/project');

      expect(result).toHaveLength(0);
    });
  });

  describe('saveUserRepos', () => {
    it('should save repos to file', async () => {
      const repos: KnownRepo[] = [
        {
          url: 'https://github.com/test/repo',
          capabilities: ['cap1'],
          keywords: ['key1'],
        },
      ];

      await saveUserRepos('/project', repos);

      const content = vol.readFileSync('/project/known-repos.json', 'utf8');
      const parsed = JSON.parse(content as string);

      expect(parsed.version).toBe('1.0');
      expect(parsed.repos).toHaveLength(1);
      expect(parsed.repos[0].url).toBe('https://github.com/test/repo');
    });

    it('should overwrite existing file', async () => {
      vol.writeFileSync('/project/known-repos.json', JSON.stringify({ version: '1.0', repos: [] }));

      const repos: KnownRepo[] = [
        { url: 'https://github.com/new/repo', capabilities: ['new'], keywords: ['new'] },
      ];

      await saveUserRepos('/project', repos);

      const content = vol.readFileSync('/project/known-repos.json', 'utf8');
      const parsed = JSON.parse(content as string);

      expect(parsed.repos).toHaveLength(1);
      expect(parsed.repos[0].url).toBe('https://github.com/new/repo');
    });
  });

  describe('generateSuggestions', () => {
    it('should generate keyword match suggestions', async () => {
      const cache: WorkflowCache = {
        version: '1.0',
        patterns: [
          { id: 'p1', type: 'tool_invocation', trigger: 'git commit message', frequency: 5, lastSeen: '' },
        ],
      };
      const repos = {
        version: '1.0',
        repos: [
          { url: 'https://github.com/test/git-helper', capabilities: ['commit-wizard'], keywords: ['git', 'commit'] },
        ],
      };

      vol.writeFileSync('/project/workflow-cache.json', JSON.stringify(cache));
      vol.writeFileSync('/project/known-repos.json', JSON.stringify(repos));

      const suggestions = await generateSuggestions('/project');

      expect(suggestions.length).toBeGreaterThan(0);
      expect(suggestions[0].type).toBe('keyword_match');
      expect(suggestions[0].repo).toBe('https://github.com/test/git-helper');
      expect(suggestions[0].confidence).toBe('high'); // frequency >= 5
    });

    it('should generate friction suggestions for errors', async () => {
      const cache: WorkflowCache = {
        version: '1.0',
        patterns: [
          { id: 'p1', type: 'error', trigger: 'network timeout error', frequency: 4, lastSeen: '' },
        ],
      };
      const repos = {
        version: '1.0',
        repos: [
          { url: 'https://github.com/test/network', capabilities: ['network'], keywords: ['http'] },
        ],
      };

      vol.writeFileSync('/project/workflow-cache.json', JSON.stringify(cache));
      vol.writeFileSync('/project/known-repos.json', JSON.stringify(repos));

      const suggestions = await generateSuggestions('/project');

      expect(suggestions.some(s => s.type === 'friction')).toBe(true);
    });

    it('should filter patterns below minimum frequency', async () => {
      const cache: WorkflowCache = {
        version: '1.0',
        patterns: [
          { id: 'p1', type: 'tool_invocation', trigger: 'git commit', frequency: 2, lastSeen: '' }, // below MIN_FREQUENCY
        ],
      };
      const repos = {
        version: '1.0',
        repos: [
          { url: 'https://github.com/test/git', capabilities: ['git'], keywords: ['git'] },
        ],
      };

      vol.writeFileSync('/project/workflow-cache.json', JSON.stringify(cache));
      vol.writeFileSync('/project/known-repos.json', JSON.stringify(repos));

      const suggestions = await generateSuggestions('/project');

      expect(suggestions).toHaveLength(0);
    });

    it('should deduplicate suggestions by repo+capability', async () => {
      const cache: WorkflowCache = {
        version: '1.0',
        patterns: [
          { id: 'p1', type: 'tool_invocation', trigger: 'git commit', frequency: 5, lastSeen: '' },
          { id: 'p2', type: 'tool_invocation', trigger: 'git push', frequency: 5, lastSeen: '' },
        ],
      };
      const repos = {
        version: '1.0',
        repos: [
          { url: 'https://github.com/test/git', capabilities: ['git-helper'], keywords: ['git'] },
        ],
      };

      vol.writeFileSync('/project/workflow-cache.json', JSON.stringify(cache));
      vol.writeFileSync('/project/known-repos.json', JSON.stringify(repos));

      const suggestions = await generateSuggestions('/project');

      // Should only have one suggestion despite two matching patterns
      const gitHelperSuggestions = suggestions.filter(
        s => s.repo === 'https://github.com/test/git' && s.capability === 'git-helper'
      );
      expect(gitHelperSuggestions).toHaveLength(1);
    });

    it('should return empty array when no patterns', async () => {
      const cache: WorkflowCache = { version: '1.0', patterns: [] };
      vol.writeFileSync('/project/workflow-cache.json', JSON.stringify(cache));

      const suggestions = await generateSuggestions('/project');

      expect(suggestions).toHaveLength(0);
    });

    it('should assign medium confidence for frequency 3-4', async () => {
      const cache: WorkflowCache = {
        version: '1.0',
        patterns: [
          { id: 'p1', type: 'tool_invocation', trigger: 'docker build', frequency: 3, lastSeen: '' },
        ],
      };
      const repos = {
        version: '1.0',
        repos: [
          { url: 'https://github.com/test/docker', capabilities: ['docker-helper'], keywords: ['docker'] },
        ],
      };

      vol.writeFileSync('/project/workflow-cache.json', JSON.stringify(cache));
      vol.writeFileSync('/project/known-repos.json', JSON.stringify(repos));

      const suggestions = await generateSuggestions('/project');

      expect(suggestions[0].confidence).toBe('medium');
    });
  });
});
