import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vol } from 'memfs';
import { installForCursor } from '../../../src/adapters/cursor.js';
import { createMockSkill } from '../../mocks/factories.js';

// Mock fs/promises with memfs
vi.mock('fs/promises', async () => {
  const memfs = await import('memfs');
  return memfs.fs.promises;
});

describe('Cursor Adapter', () => {
  beforeEach(() => {
    vol.reset();
    vol.mkdirSync('/project', { recursive: true });
  });

  describe('installForCursor', () => {
    it('should create rule file in .cursor/rules/', async () => {
      const skill = createMockSkill({
        name: 'cursor-rule',
        content: '# Cursor Rule\n\nFollow this.',
      });

      const result = await installForCursor(skill, '/project', 'rule-123');

      expect(result.filesWritten).toContain('.cursor/rules/rule-123.mdc');
      expect(vol.existsSync('/project/.cursor/rules/rule-123.mdc')).toBe(true);
    });

    it('should include skill content in MDC file', async () => {
      const skill = createMockSkill({
        name: 'content-rule',
        content: '# Rule Content\n\n- Point 1\n- Point 2',
      });

      await installForCursor(skill, '/project', 'content-rule');

      const content = vol.readFileSync('/project/.cursor/rules/content-rule.mdc', 'utf8');
      expect(content).toContain('# Rule Content');
      expect(content).toContain('- Point 1');
    });

    it('should include MDC frontmatter with description', async () => {
      const skill = createMockSkill({
        name: 'desc-rule',
        description: 'A rule with description',
      });

      await installForCursor(skill, '/project', 'desc-rule');

      const content = vol.readFileSync('/project/.cursor/rules/desc-rule.mdc', 'utf8');
      expect(content).toContain('---');
      expect(content).toContain('description: A rule with description');
    });

    it('should include alwaysApply field defaulting to false', async () => {
      const skill = createMockSkill({ name: 'apply-rule' });

      await installForCursor(skill, '/project', 'apply-rule');

      const content = vol.readFileSync('/project/.cursor/rules/apply-rule.mdc', 'utf8');
      expect(content).toContain('alwaysApply: false');
    });

    it('should preserve globs from original frontmatter', async () => {
      const skill = createMockSkill({
        name: 'glob-rule',
        frontmatter: { globs: ['*.ts', '*.tsx'] },
      });

      await installForCursor(skill, '/project', 'glob-rule');

      const content = vol.readFileSync('/project/.cursor/rules/glob-rule.mdc', 'utf8');
      expect(content).toContain('globs:');
    });

    it('should create .cursor/rules directory if missing', async () => {
      const skill = createMockSkill({ name: 'init-rule' });

      await installForCursor(skill, '/project', 'init-rule');

      expect(vol.existsSync('/project/.cursor/rules')).toBe(true);
    });

    it('should set configUpdated to false (MDC is self-contained)', async () => {
      const skill = createMockSkill({ name: 'self-contained' });

      const result = await installForCursor(skill, '/project', 'self-rule');

      expect(result.configUpdated).toBe(false);
    });

    it('should return errors array on failure', async () => {
      const skill = createMockSkill({ name: 'error-rule' });

      const result = await installForCursor(skill, '/project', 'err-rule');

      expect(result).toHaveProperty('errors');
      expect(Array.isArray(result.errors)).toBe(true);
    });
  });
});
