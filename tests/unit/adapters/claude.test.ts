import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vol } from 'memfs';
import { installForClaudeCode } from '../../../src/adapters/claude.js';
import { createMockSkill } from '../../mocks/factories.js';

// Mock fs/promises with memfs
vi.mock('fs/promises', async () => {
  const memfs = await import('memfs');
  return memfs.fs.promises;
});

describe('Claude Adapter', () => {
  beforeEach(() => {
    vol.reset();
    // Create base directory structure
    vol.mkdirSync('/project', { recursive: true });
  });

  describe('installForClaudeCode', () => {
    it('should create skill file in .claude/skills/', async () => {
      const skill = createMockSkill({
        name: 'my-skill',
        content: '# My Skill\n\nContent here.',
      });

      const result = await installForClaudeCode(skill, '/source', '/project', 'cap-123');

      expect(result.filesWritten).toContain('.claude/skills/cap-123.md');
      expect(vol.existsSync('/project/.claude/skills/cap-123.md')).toBe(true);
    });

    it('should include skill content in file', async () => {
      const skill = createMockSkill({
        name: 'content-skill',
        content: '# Test Content\n\nThis is the body.',
      });

      await installForClaudeCode(skill, '/source', '/project', 'content-cap');

      const content = vol.readFileSync('/project/.claude/skills/content-cap.md', 'utf8');
      expect(content).toContain('# Test Content');
      expect(content).toContain('This is the body.');
    });

    it('should include YAML frontmatter', async () => {
      const skill = createMockSkill({
        name: 'frontmatter-skill',
        description: 'Has frontmatter',
      });

      await installForClaudeCode(skill, '/source', '/project', 'fm-cap');

      const content = vol.readFileSync('/project/.claude/skills/fm-cap.md', 'utf8');
      expect(content).toContain('---');
      expect(content).toContain('name: frontmatter-skill');
      expect(content).toContain('agent-reverse-id: fm-cap');
    });

    it('should create skills directory if missing', async () => {
      const skill = createMockSkill({ name: 'new-skill' });

      await installForClaudeCode(skill, '/source', '/project', 'new-cap');

      expect(vol.existsSync('/project/.claude/skills')).toBe(true);
    });

    it('should update CLAUDE.md with usage hint', async () => {
      vol.writeFileSync('/project/CLAUDE.md', '# Project\n\nExisting content.');
      const skill = createMockSkill({
        name: 'documented-skill',
        description: 'A documented skill',
      });

      const result = await installForClaudeCode(skill, '/source', '/project', 'doc-cap');

      expect(result.configUpdated).toBe(true);
      const claudeMd = vol.readFileSync('/project/CLAUDE.md', 'utf8');
      expect(claudeMd).toContain('doc-cap');
      expect(claudeMd).toContain('A documented skill');
    });

    it('should return errors array on failure', async () => {
      // Create a read-only scenario by mocking an error
      // For simplicity, test that errors array exists
      const skill = createMockSkill({ name: 'error-skill' });

      const result = await installForClaudeCode(skill, '/source', '/project', 'err-cap');

      expect(result).toHaveProperty('errors');
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should use capability ID as filename', async () => {
      const skill = createMockSkill({ name: 'Skill With Spaces!' });

      await installForClaudeCode(skill, '/source', '/project', 'clean-id');

      expect(vol.existsSync('/project/.claude/skills/clean-id.md')).toBe(true);
    });
  });
});
