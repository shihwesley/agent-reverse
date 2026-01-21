import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { vol } from 'memfs';

// Mock fs/promises with memfs
vi.mock('fs/promises', async () => {
  const memfs = await import('memfs');
  return memfs.fs.promises;
});

// Mock simple-git
const mockGit = {
  clone: vi.fn().mockResolvedValue(undefined),
  log: vi.fn().mockResolvedValue({ latest: { hash: 'abc123def456' } }),
};

vi.mock('simple-git', () => ({
  simpleGit: vi.fn((path?: string) => {
    if (path) {
      // Return mock for local git operations (after clone)
      return mockGit;
    }
    // Return mock for global git operations (clone)
    return mockGit;
  }),
}));

// Import after mocks are set up
import { fetchRepo, cleanupClone, cleanupAllClones } from '../../../src/tools/fetch.js';

describe('Fetch Tool', () => {
  beforeEach(() => {
    vol.reset();
    vol.mkdirSync('/project', { recursive: true });
    vi.clearAllMocks();

    // Setup mock clone behavior - create files in the cloned directory
    mockGit.clone.mockImplementation(async (url: string, path: string) => {
      vol.mkdirSync(path, { recursive: true });
      vol.writeFileSync(`${path}/README.md`, '# Test Repo');
      vol.writeFileSync(`${path}/package.json`, '{}');
      vol.mkdirSync(`${path}/src`, { recursive: true });
      vol.writeFileSync(`${path}/src/index.ts`, 'export {}');
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchRepo', () => {
    it('should clone repository to .tmp directory', async () => {
      const result = await fetchRepo('https://github.com/test/repo', undefined, '/project');

      expect(mockGit.clone).toHaveBeenCalled();
      expect(result.path).toContain('.tmp');
    });

    it('should return commit hash', async () => {
      const result = await fetchRepo('https://github.com/test/repo', undefined, '/project');

      expect(result.commit).toBe('abc123def456');
    });

    it('should return list of files', async () => {
      const result = await fetchRepo('https://github.com/test/repo', undefined, '/project');

      expect(result.files).toContain('README.md');
      expect(result.files).toContain('package.json');
      expect(result.files).toContain('src/index.ts');
    });

    it('should support branch parameter', async () => {
      await fetchRepo('https://github.com/test/repo', 'develop', '/project');

      expect(mockGit.clone).toHaveBeenCalledWith(
        'https://github.com/test/repo',
        expect.any(String),
        expect.arrayContaining(['--branch', 'develop'])
      );
    });

    it('should perform shallow clone with depth 1', async () => {
      await fetchRepo('https://github.com/test/repo', undefined, '/project');

      expect(mockGit.clone).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.arrayContaining(['--depth', '1'])
      );
    });

    it('should exclude .git directory from file list', async () => {
      // Add .git directory to mock
      mockGit.clone.mockImplementation(async (url: string, path: string) => {
        vol.mkdirSync(path, { recursive: true });
        vol.mkdirSync(`${path}/.git`, { recursive: true });
        vol.writeFileSync(`${path}/.git/config`, '');
        vol.writeFileSync(`${path}/README.md`, '# Test');
      });

      const result = await fetchRepo('https://github.com/test/repo', undefined, '/project');

      expect(result.files).not.toContain('.git/config');
      expect(result.files).toContain('README.md');
    });
  });

  describe('cleanupClone', () => {
    it('should return false for non-existent clone', async () => {
      const result = await cleanupClone('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('cleanupAllClones', () => {
    it('should return count of cleaned clones', async () => {
      // First fetch to create a clone
      await fetchRepo('https://github.com/test/repo', undefined, '/project');

      const count = await cleanupAllClones();

      expect(typeof count).toBe('number');
    });
  });
});
