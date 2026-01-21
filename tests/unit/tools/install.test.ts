import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vol } from 'memfs';

// Mock fs/promises with memfs
vi.mock('fs/promises', async () => {
  const memfs = await import('memfs');
  return memfs.fs.promises;
});

// Mock os.homedir for Antigravity adapter
vi.mock('os', () => ({
  homedir: () => '/home/user',
}));

import { installCapability } from '../../../src/tools/install.js';

describe('Install Tool', () => {
  beforeEach(() => {
    vol.reset();
    vol.mkdirSync('/project', { recursive: true });
    vol.mkdirSync('/source', { recursive: true });
    vol.mkdirSync('/home/user', { recursive: true });
  });

  describe('installCapability', () => {
    it('should route to Claude adapter for claude-code target', async () => {
      vol.writeFileSync('/source/skill.md', `---
name: test-skill
description: A test skill
---

# Test Skill

Content here.`);

      const result = await installCapability({
        skillPath: 'skill.md',
        sourceRepoPath: '/source',
        sourceUrl: 'https://github.com/test/repo',
        commit: 'abc123',
        capabilityId: 'test-cap',
        targetAgent: 'claude-code',
        workspaceRoot: '/project',
      });

      expect(result.filesWritten.some(f => f.includes('.claude/skills'))).toBe(true);
    });

    it('should route to Cursor adapter for cursor target', async () => {
      vol.writeFileSync('/source/skill.md', `---
name: cursor-skill
description: A cursor skill
---

# Cursor Skill`);

      const result = await installCapability({
        skillPath: 'skill.md',
        sourceRepoPath: '/source',
        sourceUrl: 'https://github.com/test/repo',
        commit: 'abc123',
        capabilityId: 'cursor-cap',
        targetAgent: 'cursor',
        workspaceRoot: '/project',
      });

      expect(result.filesWritten.some(f => f.includes('.cursor/rules'))).toBe(true);
    });

    it('should route to Antigravity adapter for antigravity target', async () => {
      vol.writeFileSync('/source/skill.md', `---
name: ag-skill
description: An antigravity skill
---

# AG Skill`);

      const result = await installCapability({
        skillPath: 'skill.md',
        sourceRepoPath: '/source',
        sourceUrl: 'https://github.com/test/repo',
        commit: 'abc123',
        capabilityId: 'ag-cap',
        targetAgent: 'antigravity',
        workspaceRoot: '/project',
      });

      expect(result.filesWritten.some(f => f.includes('.agent/skills'))).toBe(true);
    });

    it('should return error for unknown target agent', async () => {
      vol.writeFileSync('/source/skill.md', `---
name: unknown-skill
---

Content`);

      const result = await installCapability({
        skillPath: 'skill.md',
        sourceRepoPath: '/source',
        sourceUrl: 'https://github.com/test/repo',
        commit: 'abc123',
        capabilityId: 'unknown-cap',
        targetAgent: 'unknown' as any,
        workspaceRoot: '/project',
      });

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('Unknown target agent'))).toBe(true);
    });

    it('should return error for custom target (not yet supported)', async () => {
      vol.writeFileSync('/source/skill.md', `---
name: custom-skill
---

Content`);

      const result = await installCapability({
        skillPath: 'skill.md',
        sourceRepoPath: '/source',
        sourceUrl: 'https://github.com/test/repo',
        commit: 'abc123',
        capabilityId: 'custom-cap',
        targetAgent: 'custom',
        workspaceRoot: '/project',
      });

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('custom'))).toBe(true);
    });

    it('should return error for invalid skill file', async () => {
      vol.writeFileSync('/source/invalid.md', '# No frontmatter');

      const result = await installCapability({
        skillPath: 'invalid.md',
        sourceRepoPath: '/source',
        sourceUrl: 'https://github.com/test/repo',
        commit: 'abc123',
        capabilityId: 'invalid-cap',
        targetAgent: 'claude-code',
        workspaceRoot: '/project',
      });

      expect(result.success).toBe(false);
      expect(result.errors.some(e => e.includes('Failed to parse'))).toBe(true);
    });

    it('should include capability ID in result', async () => {
      vol.writeFileSync('/source/skill.md', `---
name: id-skill
---

Content`);

      const result = await installCapability({
        skillPath: 'skill.md',
        sourceRepoPath: '/source',
        sourceUrl: 'https://github.com/test/repo',
        commit: 'abc123',
        capabilityId: 'my-unique-id',
        targetAgent: 'claude-code',
        workspaceRoot: '/project',
      });

      expect(result.capabilityId).toBe('my-unique-id');
    });

    it('should support global scope for antigravity', async () => {
      vol.writeFileSync('/source/skill.md', `---
name: global-skill
---

Content`);

      const result = await installCapability({
        skillPath: 'skill.md',
        sourceRepoPath: '/source',
        sourceUrl: 'https://github.com/test/repo',
        commit: 'abc123',
        capabilityId: 'global-cap',
        targetAgent: 'antigravity',
        workspaceRoot: '/project',
        scope: 'global',
      });

      expect(result.filesWritten.some(f => f.includes('~/.gemini'))).toBe(true);
    });
  });
});
