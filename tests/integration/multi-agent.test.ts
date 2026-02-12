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

// Import after mocks
import { installCapability } from '../../src/tools/install.js';
import { listCapabilities } from '../../src/tools/manifest.js';

describe('Integration: Multi-Agent Adapter Flow', () => {
  beforeEach(() => {
    vol.reset();
    mockGit.clone.mockClear();
    mockGit.log.mockClear();
  });

  it('should install same skill to multiple agent types', async () => {
    // Create skill in repo
    const repoPath = '/repo';
    vol.mkdirSync(`${repoPath}/skills`, { recursive: true });
    vol.writeFileSync(`${repoPath}/skills/universal.md`, `---
name: universal-skill
description: A universal skill
---
# Universal Skill
Works everywhere.`);

    // Install for Claude Code
    vol.mkdirSync('/claude-project', { recursive: true });
    const claudeResult = await installCapability({
      skillPath: 'skills/universal.md',
      sourceRepoPath: repoPath,
      sourceUrl: 'https://github.com/test/repo',
      commit: 'abc123',
      capabilityId: 'universal-skill',
      targetAgent: 'claude-code',
      workspaceRoot: '/claude-project',
    });

    expect(claudeResult.success).toBe(true);
    expect(vol.existsSync('/claude-project/.claude/skills/universal-skill/SKILL.md')).toBe(true);

    // Install for Cursor
    vol.mkdirSync('/cursor-project', { recursive: true });
    const cursorResult = await installCapability({
      skillPath: 'skills/universal.md',
      sourceRepoPath: repoPath,
      sourceUrl: 'https://github.com/test/repo',
      commit: 'abc123',
      capabilityId: 'universal-skill-cursor',
      targetAgent: 'cursor',
      workspaceRoot: '/cursor-project',
    });

    expect(cursorResult.success).toBe(true);
    expect(vol.existsSync('/cursor-project/.cursor/rules/universal-skill-cursor.mdc')).toBe(true);

    // Install for Antigravity
    vol.mkdirSync('/antigravity-project', { recursive: true });
    const antigravityResult = await installCapability({
      skillPath: 'skills/universal.md',
      sourceRepoPath: repoPath,
      sourceUrl: 'https://github.com/test/repo',
      commit: 'abc123',
      capabilityId: 'universal-skill-ag',
      targetAgent: 'antigravity',
      workspaceRoot: '/antigravity-project',
    });

    expect(antigravityResult.success).toBe(true);
    expect(vol.existsSync('/antigravity-project/.agent/skills/universal-skill-ag/SKILL.md')).toBe(true);
  });

  it('should track capabilities per project in manifest', async () => {
    // Setup repo
    const repoPath = '/repo';
    vol.mkdirSync(`${repoPath}/skills`, { recursive: true });
    vol.writeFileSync(`${repoPath}/skills/skill1.md`, '---\nname: skill1\ndescription: Test\n---\n# Skill 1');
    vol.writeFileSync(`${repoPath}/skills/skill2.md`, '---\nname: skill2\ndescription: Test\n---\n# Skill 2');

    // Install to Claude project
    vol.mkdirSync('/project', { recursive: true });
    await installCapability({
      skillPath: 'skills/skill1.md',
      sourceRepoPath: repoPath,
      sourceUrl: 'https://github.com/test/repo1',
      commit: 'abc123',
      capabilityId: 'skill1',
      targetAgent: 'claude-code',
      workspaceRoot: '/project',
    });

    await installCapability({
      skillPath: 'skills/skill2.md',
      sourceRepoPath: repoPath,
      sourceUrl: 'https://github.com/test/repo2',
      commit: 'def456',
      capabilityId: 'skill2',
      targetAgent: 'claude-code',
      workspaceRoot: '/project',
    });

    // Verify manifest tracks both
    const capabilities = await listCapabilities('/project');
    expect(capabilities).toHaveLength(2);
    expect(capabilities.some(c => c.id === 'skill1')).toBe(true);
    expect(capabilities.some(c => c.id === 'skill2')).toBe(true);
  });

  it('should use correct adapter paths for each agent', async () => {
    // Create skill in repo
    vol.mkdirSync('/repo/skills', { recursive: true });
    vol.writeFileSync('/repo/skills/test.md', '---\nname: test-skill\ndescription: Test\n---\n# Test');

    // Test Claude adapter
    vol.mkdirSync('/test-claude', { recursive: true });
    const claudeResult = await installCapability({
      skillPath: 'skills/test.md',
      sourceRepoPath: '/repo',
      sourceUrl: 'https://github.com/test/repo',
      commit: 'abc123',
      capabilityId: 'test-skill',
      targetAgent: 'claude-code',
      workspaceRoot: '/test-claude',
    });
    expect(claudeResult.filesWritten).toContain('.claude/skills/test-skill/SKILL.md');

    // Test Cursor adapter
    vol.mkdirSync('/test-cursor', { recursive: true });
    const cursorResult = await installCapability({
      skillPath: 'skills/test.md',
      sourceRepoPath: '/repo',
      sourceUrl: 'https://github.com/test/repo',
      commit: 'abc123',
      capabilityId: 'test-skill',
      targetAgent: 'cursor',
      workspaceRoot: '/test-cursor',
    });
    expect(cursorResult.filesWritten).toContain('.cursor/rules/test-skill.mdc');

    // Test Antigravity adapter
    vol.mkdirSync('/test-antigravity', { recursive: true });
    const antigravityResult = await installCapability({
      skillPath: 'skills/test.md',
      sourceRepoPath: '/repo',
      sourceUrl: 'https://github.com/test/repo',
      commit: 'abc123',
      capabilityId: 'test-skill',
      targetAgent: 'antigravity',
      workspaceRoot: '/test-antigravity',
    });
    expect(antigravityResult.filesWritten).toContain('.agent/skills/test-skill/SKILL.md');
  });

  it('should preserve skill content across adapters', async () => {
    const skillContent = `---
name: content-test
description: Test content preservation
---
# Content Test

Important instructions that must be preserved.

- Point 1
- Point 2
- Point 3`;

    // Create repo with skill
    vol.mkdirSync('/repo/skills', { recursive: true });
    vol.writeFileSync('/repo/skills/content.md', skillContent);

    // Install to each agent type
    const projects = [
      { path: '/claude', agent: 'claude-code' as const, file: '.claude/skills/content-test/SKILL.md' },
      { path: '/cursor', agent: 'cursor' as const, file: '.cursor/rules/content-test.mdc' },
      { path: '/antigravity', agent: 'antigravity' as const, file: '.agent/skills/content-test/SKILL.md' },
    ];

    for (const project of projects) {
      vol.mkdirSync(project.path, { recursive: true });
      await installCapability({
        skillPath: 'skills/content.md',
        sourceRepoPath: '/repo',
        sourceUrl: 'https://github.com/test/repo',
        commit: 'abc123',
        capabilityId: 'content-test',
        targetAgent: project.agent,
        workspaceRoot: project.path,
      });

      const installed = vol.readFileSync(`${project.path}/${project.file}`, 'utf8') as string;
      expect(installed).toContain('Important instructions');
      expect(installed).toContain('Point 1');
    }
  });
});
