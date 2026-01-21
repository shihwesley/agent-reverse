import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vol } from 'memfs';
import { installForAntigravity } from '../../../src/adapters/antigravity.js';
import { createMockSkill } from '../../mocks/factories.js';

// Mock fs/promises with memfs
vi.mock('fs/promises', async () => {
  const memfs = await import('memfs');
  return memfs.fs.promises;
});

// Mock os.homedir
vi.mock('os', () => ({
  homedir: () => '/home/user',
}));

describe('Antigravity Adapter', () => {
  beforeEach(() => {
    vol.reset();
    vol.mkdirSync('/project', { recursive: true });
    vol.mkdirSync('/home/user', { recursive: true });
  });

  describe('installForAntigravity', () => {
    it('should create SKILL.md in .agent/skills/{id}/', async () => {
      const skill = createMockSkill({
        name: 'ag-skill',
        content: '# Antigravity Skill',
      });

      const result = await installForAntigravity(skill, '/project', 'ag-123');

      expect(result.filesWritten[0]).toContain('.agent/skills/ag-123/SKILL.md');
      expect(vol.existsSync('/project/.agent/skills/ag-123/SKILL.md')).toBe(true);
    });

    it('should include skill content in file', async () => {
      const skill = createMockSkill({
        name: 'content-skill',
        content: '# Content Here\n\nBody text.',
      });

      await installForAntigravity(skill, '/project', 'content-cap');

      const content = vol.readFileSync('/project/.agent/skills/content-cap/SKILL.md', 'utf8');
      expect(content).toContain('# Content Here');
      expect(content).toContain('Body text.');
    });

    it('should include frontmatter with name and description', async () => {
      const skill = createMockSkill({
        name: 'meta-skill',
        description: 'A skill with metadata',
      });

      await installForAntigravity(skill, '/project', 'meta-cap');

      const content = vol.readFileSync('/project/.agent/skills/meta-cap/SKILL.md', 'utf8');
      expect(content).toContain('---');
      expect(content).toContain('name: meta-skill');
      expect(content).toContain('description: A skill with metadata');
    });

    it('should support global scope', async () => {
      const skill = createMockSkill({ name: 'global-skill' });

      const result = await installForAntigravity(skill, '/project', 'global-cap', 'global');

      expect(result.filesWritten[0]).toContain('~/.gemini/antigravity/skills/global-cap/SKILL.md');
      expect(vol.existsSync('/home/user/.gemini/antigravity/skills/global-cap/SKILL.md')).toBe(true);
    });

    it('should create skills directory if missing', async () => {
      const skill = createMockSkill({ name: 'new-skill' });

      await installForAntigravity(skill, '/project', 'new-cap');

      expect(vol.existsSync('/project/.agent/skills/new-cap')).toBe(true);
    });

    it('should set configUpdated to false (SKILL.md is self-contained)', async () => {
      const skill = createMockSkill({ name: 'self-contained' });

      const result = await installForAntigravity(skill, '/project', 'self-cap');

      expect(result.configUpdated).toBe(false);
    });

    it('should return errors array on failure', async () => {
      const skill = createMockSkill({ name: 'error-skill' });

      const result = await installForAntigravity(skill, '/project', 'err-cap');

      expect(result).toHaveProperty('errors');
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should default to project scope', async () => {
      const skill = createMockSkill({ name: 'default-scope' });

      await installForAntigravity(skill, '/project', 'default-cap');

      // Should be in project path, not global
      expect(vol.existsSync('/project/.agent/skills/default-cap/SKILL.md')).toBe(true);
      expect(vol.existsSync('/home/user/.gemini/antigravity/skills/default-cap/SKILL.md')).toBe(false);
    });
  });
});
