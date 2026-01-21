import { describe, it, expect } from 'vitest';
import { parseSkillFile, isSkillPath } from '../../../src/parsers/skill.js';

describe('Skill Parser', () => {
  describe('parseSkillFile', () => {
    it('should parse skill with YAML frontmatter', () => {
      const content = `---
name: test-skill
description: A test skill
---

# Test Skill

This is the body.`;

      const result = parseSkillFile(content, 'skills/test.md');

      expect(result).not.toBeNull();
      expect(result!.name).toBe('test-skill');
      expect(result!.description).toBe('A test skill');
      expect(result!.content).toContain('# Test Skill');
    });

    it('should return null for skill without frontmatter', () => {
      const content = `# Simple Skill

No frontmatter here.`;

      const result = parseSkillFile(content, 'skills/simple.md');

      expect(result).toBeNull();
    });

    it('should extract name from path if not in frontmatter', () => {
      const content = `---
description: Has description but no name
---

Content here.`;

      const result = parseSkillFile(content, 'skills/my-skill.md');

      expect(result).not.toBeNull();
      expect(result!.name).toBe('my-skill');
    });

    it('should extract metadata fields into frontmatter', () => {
      const content = `---
name: metadata-skill
tags:
  - testing
  - example
author: test
---

Content here.`;

      const result = parseSkillFile(content, 'skills/meta.md');

      expect(result).not.toBeNull();
      expect(result!.frontmatter.tags).toEqual(['testing', 'example']);
      expect(result!.frontmatter.author).toBe('test');
    });

    it('should handle empty content', () => {
      const result = parseSkillFile('', 'skills/empty.md');

      expect(result).toBeNull();
    });

    it('should return null for malformed YAML frontmatter', () => {
      const content = `---
name: broken
invalid yaml: [
---

Body content.`;

      const result = parseSkillFile(content, 'skills/broken.md');

      expect(result).toBeNull();
    });

    it('should trim body content', () => {
      const content = `---
name: trim-test
---

  Trimmed body.

`;

      const result = parseSkillFile(content, 'skills/trim.md');

      expect(result).not.toBeNull();
      expect(result!.content).toBe('Trimmed body.');
    });

    it('should include filePath in result', () => {
      const content = `---
name: path-test
---

Content.`;

      const result = parseSkillFile(content, 'custom/path/skill.md');

      expect(result).not.toBeNull();
      expect(result!.filePath).toBe('custom/path/skill.md');
    });
  });

  describe('isSkillPath', () => {
    it('should identify skill paths', () => {
      expect(isSkillPath('skills/my-skill.md')).toBe(true);
      expect(isSkillPath('prompts/prompt.md')).toBe(true);
      expect(isSkillPath('.claude/skills/test.md')).toBe(true);
    });

    it('should reject common non-skill paths', () => {
      expect(isSkillPath('project/README.md')).toBe(false);
      expect(isSkillPath('project/CHANGELOG.md')).toBe(false);
      expect(isSkillPath('project/docs/api.md')).toBe(false); // needs /docs/ with leading slash
    });

    it('should allow generic .md files', () => {
      expect(isSkillPath('some-file.md')).toBe(true);
    });
  });
});
