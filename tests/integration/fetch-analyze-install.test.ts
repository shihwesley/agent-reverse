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
};

vi.mock('simple-git', () => ({
  simpleGit: vi.fn(() => mockGit),
}));

// Import after mocks are set up
import { fetchRepo } from '../../src/tools/fetch.js';
import { analyzeRepo } from '../../src/tools/analyze.js';
import { installCapability } from '../../src/tools/install.js';
import { getCapability } from '../../src/tools/manifest.js';

describe('Integration: Fetch → Analyze → Install Flow', () => {
  beforeEach(() => {
    vol.reset();
    vol.mkdirSync('/project', { recursive: true });
    vol.mkdirSync('/project/.tmp', { recursive: true });
    mockGit.clone.mockClear();
    mockGit.log.mockClear();

    // Default mock: simulate cloned repo structure
    // Note: analyzeRepo skips hidden dirs, so use 'skills/' not '.claude/skills/'
    mockGit.clone.mockImplementation(async (_url: string, path: string) => {
      vol.mkdirSync(`${path}/skills`, { recursive: true });
      vol.writeFileSync(`${path}/skills/example.md`, `---
name: example-skill
description: An example skill from the repo
---

# Example Skill

Use this for testing.`);
      vol.writeFileSync(`${path}/README.md`, '# Test Repo\n\n## Installation\n\nnpm install');
    });
  });

  it('should complete full fetch → analyze → install flow', async () => {
    // Step 1: Fetch repository
    const fetchResult = await fetchRepo('https://github.com/test/repo', undefined, '/project');
    expect(fetchResult.path).toBeDefined();
    expect(fetchResult.commit).toBeDefined();

    // Step 2: Analyze repository
    const analyzeResult = await analyzeRepo(fetchResult.path);
    expect(analyzeResult.skills).toHaveLength(1);
    expect(analyzeResult.skills[0].name).toBe('example-skill');

    // Step 3: Install capability
    const skill = analyzeResult.skills[0];
    const installResult = await installCapability({
      skillPath: skill.filePath,
      sourceRepoPath: fetchResult.path,
      sourceUrl: 'https://github.com/test/repo',
      commit: fetchResult.commit,
      capabilityId: skill.name,
      targetAgent: 'claude-code',
      workspaceRoot: '/project',
    });
    expect(installResult.success).toBe(true);
    expect(installResult.filesWritten.length).toBeGreaterThan(0);

    // Step 4: Verify manifest updated
    const capability = await getCapability('/project', 'example-skill');
    expect(capability).not.toBeNull();
    expect(capability?.source).toBe('https://github.com/test/repo');
  });

  it('should handle repo with multiple skills', async () => {
    mockGit.clone.mockImplementation(async (_url: string, path: string) => {
      vol.mkdirSync(`${path}/skills`, { recursive: true });
      vol.writeFileSync(`${path}/skills/skill1.md`, '---\nname: skill1\ndescription: First skill\n---\n# Skill 1');
      vol.writeFileSync(`${path}/skills/skill2.md`, '---\nname: skill2\ndescription: Second skill\n---\n# Skill 2');
      vol.writeFileSync(`${path}/skills/skill3.md`, '---\nname: skill3\ndescription: Third skill\n---\n# Skill 3');
    });

    const fetchResult = await fetchRepo('https://github.com/multi/repo', undefined, '/project');
    const analysis = await analyzeRepo(fetchResult.path);

    expect(analysis.skills).toHaveLength(3);

    // Install all skills
    for (const skill of analysis.skills) {
      await installCapability({
        skillPath: skill.filePath,
        sourceRepoPath: fetchResult.path,
        sourceUrl: 'https://github.com/multi/repo',
        commit: fetchResult.commit,
        capabilityId: skill.name,
        targetAgent: 'claude-code',
        workspaceRoot: '/project',
      });
    }

    const manifest = JSON.parse(vol.readFileSync('/project/agent-reverse.json', 'utf8') as string);
    expect(manifest.capabilities).toHaveLength(3);
  });

  it('should preserve commit hash through flow', async () => {
    mockGit.log.mockResolvedValue({ latest: { hash: 'specific-commit-hash' } });

    const fetchResult = await fetchRepo('https://github.com/test/repo', undefined, '/project');
    expect(fetchResult.commit).toBe('specific-commit-hash');

    const analysis = await analyzeRepo(fetchResult.path);

    await installCapability({
      skillPath: analysis.skills[0].filePath,
      sourceRepoPath: fetchResult.path,
      sourceUrl: 'https://github.com/test/repo',
      commit: fetchResult.commit,
      capabilityId: analysis.skills[0].name,
      targetAgent: 'claude-code',
      workspaceRoot: '/project',
    });

    const capability = await getCapability('/project', analysis.skills[0].name);
    expect(capability?.commit).toBe('specific-commit-hash');
  });

  it('should handle different target agents', async () => {
    const fetchResult = await fetchRepo('https://github.com/test/repo', undefined, '/project');
    const analysis = await analyzeRepo(fetchResult.path);
    const skill = analysis.skills[0];

    // Install for Cursor
    vol.mkdirSync('/project-cursor', { recursive: true });
    await installCapability({
      skillPath: skill.filePath,
      sourceRepoPath: fetchResult.path,
      sourceUrl: 'https://github.com/test/repo',
      commit: fetchResult.commit,
      capabilityId: `${skill.name}-cursor`,
      targetAgent: 'cursor',
      workspaceRoot: '/project-cursor',
    });

    expect(vol.existsSync('/project-cursor/.cursor/rules')).toBe(true);
  });
});
