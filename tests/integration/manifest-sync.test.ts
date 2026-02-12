import { describe, it, expect, vi, beforeEach } from 'vitest';
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
  fetch: vi.fn().mockResolvedValue(undefined),
  revparse: vi.fn().mockResolvedValue('abc123def456'),
  listRemote: vi.fn().mockResolvedValue('abc123def456\tHEAD'),
};

vi.mock('simple-git', () => ({
  simpleGit: vi.fn(() => mockGit),
}));

// Import after mocks are set up
import { manifestSync, manifestCheckUpdates } from '../../src/tools/sync.js';
import { createMockCapability, createMockManifest } from '../mocks/factories.js';

describe('Integration: Manifest Sync Flow', () => {
  beforeEach(() => {
    vol.reset();
    vol.mkdirSync('/project/.claude/skills', { recursive: true });
    vol.mkdirSync('/project/.tmp', { recursive: true });
    mockGit.clone.mockClear();
    mockGit.log.mockClear();
    mockGit.fetch.mockClear();
    mockGit.revparse.mockClear();
    mockGit.listRemote.mockClear();
    mockGit.listRemote.mockResolvedValue('abc123def456\tHEAD');
  });

  it('should sync manifest to new environment', async () => {
    // Setup: Create manifest with capabilities
    const manifest = createMockManifest({
      capabilities: [
        createMockCapability({
          id: 'cap-1',
          source: 'https://github.com/test/repo1',
          commit: 'abc123',
          extractedFrom: 'skills/cap-1.md',
        }),
        createMockCapability({
          id: 'cap-2',
          source: 'https://github.com/test/repo2',
          commit: 'def456',
          extractedFrom: 'skills/cap-2.md',
        }),
      ],
    });
    vol.writeFileSync('/project/agent-reverse.json', JSON.stringify(manifest));

    // Mock git to simulate re-cloning
    mockGit.clone.mockImplementation(async (_url: string, path: string) => {
      const id = _url.includes('repo1') ? 'cap-1' : 'cap-2';
      vol.mkdirSync(`${path}/skills`, { recursive: true });
      vol.writeFileSync(`${path}/skills/${id}.md`, `---\nname: ${id}\ndescription: Test skill\n---\n# ${id}`);
    });

    // Sync
    const syncResult = await manifestSync('/project');

    expect(syncResult.installed).toHaveLength(2);
    expect(syncResult.installed).toContain('cap-1');
    expect(syncResult.installed).toContain('cap-2');
    expect(vol.existsSync('/project/.claude/skills/cap-1/SKILL.md')).toBe(true);
    expect(vol.existsSync('/project/.claude/skills/cap-2/SKILL.md')).toBe(true);
  });

  it('should check for updates and report outdated', async () => {
    const manifest = createMockManifest({
      capabilities: [
        createMockCapability({
          id: 'outdated-cap',
          source: 'https://github.com/test/repo',
          commit: 'old-commit',
          status: 'installed',
        }),
      ],
    });
    vol.writeFileSync('/project/agent-reverse.json', JSON.stringify(manifest));

    // Mock git to return new commit via listRemote (must be valid hex)
    mockGit.listRemote.mockResolvedValue('def456abc123def456abc123def456abc123def4\tHEAD');

    const updateResult = await manifestCheckUpdates('/project');

    expect(updateResult.outdated).toHaveLength(1);
    expect(updateResult.outdated[0].id).toBe('outdated-cap');
    expect(updateResult.outdated[0].pinnedCommit).toBe('old-commit');
    expect(updateResult.outdated[0].latestCommit).toBe('def456abc123def456abc123def456abc123def4');
  });

  it('should report up-to-date capabilities', async () => {
    const manifest = createMockManifest({
      capabilities: [
        createMockCapability({
          id: 'current-cap',
          source: 'https://github.com/test/repo',
          commit: 'abc123def456abc123def456abc123def456abc1',
        }),
      ],
    });
    vol.writeFileSync('/project/agent-reverse.json', JSON.stringify(manifest));

    // Mock git to return same commit via listRemote (valid hex)
    mockGit.listRemote.mockResolvedValue('abc123def456abc123def456abc123def456abc1\tHEAD');

    const updateResult = await manifestCheckUpdates('/project');

    expect(updateResult.upToDate).toContain('current-cap');
    expect(updateResult.outdated).toHaveLength(0);
  });

  it('should handle partial sync failure', async () => {
    const manifest = createMockManifest({
      capabilities: [
        createMockCapability({ id: 'good-cap', source: 'https://github.com/good/repo', extractedFrom: 'skills/good-cap.md' }),
        createMockCapability({ id: 'bad-cap', source: 'https://github.com/bad/repo', extractedFrom: 'skills/bad-cap.md' }),
      ],
    });
    vol.writeFileSync('/project/agent-reverse.json', JSON.stringify(manifest));

    // First clone succeeds, second fails
    mockGit.clone.mockImplementation(async (url: string, path: string) => {
      if (url.includes('bad')) {
        throw new Error('Network error');
      }
      vol.mkdirSync(`${path}/skills`, { recursive: true });
      vol.writeFileSync(`${path}/skills/good-cap.md`, '---\nname: good-cap\ndescription: Good\n---\n# Good');
    });

    const syncResult = await manifestSync('/project');

    expect(syncResult.installed).toHaveLength(1);
    expect(syncResult.installed).toContain('good-cap');
    expect(syncResult.failed).toHaveLength(1);
    expect(syncResult.failed[0].id).toBe('bad-cap');
    expect(syncResult.failed[0].error).toContain('Network error');
  });

  it('should skip superseded capabilities', async () => {
    const manifest = createMockManifest({
      capabilities: [
        createMockCapability({ id: 'active-cap', source: 'https://github.com/test/repo', extractedFrom: 'skills/active.md' }),
      ],
      superseded: [
        createMockCapability({ id: 'old-cap', source: 'https://github.com/old/repo', status: 'superseded' }),
      ],
    });
    vol.writeFileSync('/project/agent-reverse.json', JSON.stringify(manifest));

    mockGit.clone.mockImplementation(async (_url: string, path: string) => {
      vol.mkdirSync(`${path}/skills`, { recursive: true });
      vol.writeFileSync(`${path}/skills/active.md`, '---\nname: active-cap\ndescription: Active\n---\n# Active');
    });

    const syncResult = await manifestSync('/project');

    expect(syncResult.installed).toContain('active-cap');
    expect(syncResult.skipped.some(s => s.includes('old-cap'))).toBe(true);
  });
});
