import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vol } from 'memfs';
import { runAudit } from '../../../src/tools/audit.js';
import { createMockManifest, createMockCapability } from '../../mocks/factories.js';

// Mock fs/promises with memfs
vi.mock('fs/promises', async () => {
  const memfs = await import('memfs');
  return memfs.fs.promises;
});

describe('Audit Tool', () => {
  const manifestPath = '/project/agent-reverse.json';

  beforeEach(() => {
    vol.reset();
    vol.mkdirSync('/project/.claude/skills', { recursive: true });
  });

  describe('runAudit', () => {
    it('should detect orphaned files', async () => {
      // Skill file exists but not tracked in manifest
      vol.writeFileSync('/project/.claude/skills/orphan.md', '# Orphan Skill');
      vol.writeFileSync(manifestPath, JSON.stringify(
        createMockManifest({ capabilities: [] })
      ));

      const result = await runAudit('/project');

      expect(result.bloat.some(b => b.reason === 'orphan' && b.id.includes('orphan.md'))).toBe(true);
      expect(result.stats.orphaned).toBeGreaterThan(0);
    });

    it('should detect duplicate capabilities by functionality', async () => {
      // Two capabilities with git-related content
      vol.writeFileSync('/project/.claude/skills/git1.md', `---
name: Git Helper
description: A git helper
---
# Git Helper

When working with git:
- Always commit your changes
- Push to branch regularly`);

      vol.writeFileSync('/project/.claude/skills/git2.md', `---
name: Git Utils
description: Git utilities
---
# Git Utils

When working with git:
- Commit often
- Merge branches cleanly`);

      const manifest = createMockManifest({
        capabilities: [
          createMockCapability({ id: 'git-1', files: ['.claude/skills/git1.md'] }),
          createMockCapability({ id: 'git-2', files: ['.claude/skills/git2.md'] }),
        ],
      });
      vol.writeFileSync(manifestPath, JSON.stringify(manifest));

      const result = await runAudit('/project');

      expect(result.duplicates.some(d => d.functionality === 'git-operations')).toBe(true);
    });

    it('should detect superseded capabilities as bloat', async () => {
      const manifest = createMockManifest({
        capabilities: [],
        superseded: [
          createMockCapability({ id: 'old-cap', source: 'https://github.com/test/old' }),
        ],
      });
      vol.writeFileSync(manifestPath, JSON.stringify(manifest));

      const result = await runAudit('/project');

      expect(result.bloat.some(b => b.reason === 'superseded' && b.id === 'old-cap')).toBe(true);
    });

    it('should scan custom paths', async () => {
      vol.mkdirSync('/project/custom/skills', { recursive: true });
      vol.writeFileSync('/project/custom/skills/custom.md', '# Custom Skill');
      vol.writeFileSync(manifestPath, JSON.stringify(createMockManifest()));

      const result = await runAudit('/project', { paths: ['custom/skills'] });

      expect(result.bloat.some(b => b.id.includes('custom.md'))).toBe(true);
    });

    it('should return clean audit for well-maintained project', async () => {
      vol.writeFileSync('/project/.claude/skills/clean.md', '# Clean Skill');
      const manifest = createMockManifest({
        capabilities: [
          createMockCapability({ id: 'clean', files: ['.claude/skills/clean.md'] }),
        ],
      });
      vol.writeFileSync(manifestPath, JSON.stringify(manifest));

      const result = await runAudit('/project');

      expect(result.bloat.filter(b => b.reason === 'orphan')).toHaveLength(0);
      expect(result.stats.orphaned).toBe(0);
    });

    it('should calculate correct stats', async () => {
      vol.writeFileSync('/project/.claude/skills/skill1.md', '# Skill 1');
      vol.writeFileSync('/project/.claude/skills/skill2.md', '# Skill 2');
      vol.writeFileSync('/project/.claude/skills/orphan.md', '# Orphan');

      const manifest = createMockManifest({
        capabilities: [
          createMockCapability({ id: 'cap-1', files: ['.claude/skills/skill1.md'] }),
          createMockCapability({ id: 'cap-2', files: ['.claude/skills/skill2.md'] }),
        ],
        superseded: [
          createMockCapability({ id: 'old-cap' }),
        ],
      });
      vol.writeFileSync(manifestPath, JSON.stringify(manifest));

      const result = await runAudit('/project');

      expect(result.stats.total).toBe(3); // 2 installed + 1 superseded
      expect(result.stats.installed).toBe(2);
      expect(result.stats.superseded).toBe(1);
      expect(result.stats.orphaned).toBe(1);
    });

    it('should generate consolidation plan for issues', async () => {
      vol.writeFileSync('/project/.claude/skills/git1.md', `---
name: Git Helper
---
# Git Helper
Working with git commits`);

      vol.writeFileSync('/project/.claude/skills/git2.md', `---
name: Git Utils
---
# Git Utils
Working with git branches`);

      const manifest = createMockManifest({
        capabilities: [
          createMockCapability({ id: 'git-1', files: ['.claude/skills/git1.md'] }),
          createMockCapability({ id: 'git-2', files: ['.claude/skills/git2.md'] }),
        ],
      });
      vol.writeFileSync(manifestPath, JSON.stringify(manifest));

      const result = await runAudit('/project');

      expect(result.consolidationPlan).toBeDefined();
      expect(typeof result.consolidationPlan).toBe('string');
    });

    it('should skip orphan detection when includeOrphans is false', async () => {
      vol.writeFileSync('/project/.claude/skills/orphan.md', '# Orphan');
      vol.writeFileSync(manifestPath, JSON.stringify(createMockManifest()));

      const result = await runAudit('/project', { includeOrphans: false });

      expect(result.bloat.filter(b => b.reason === 'orphan')).toHaveLength(0);
    });

    it('should handle missing manifest gracefully', async () => {
      // No manifest file
      vol.writeFileSync('/project/.claude/skills/skill.md', '# Skill');

      const result = await runAudit('/project');

      expect(result.stats.installed).toBe(0);
      expect(result.bloat.some(b => b.reason === 'orphan')).toBe(true);
    });

    it('should handle empty project', async () => {
      vol.writeFileSync(manifestPath, JSON.stringify(createMockManifest()));

      const result = await runAudit('/project');

      expect(result.stats.total).toBe(0);
      expect(result.duplicates).toHaveLength(0);
      expect(result.bloat).toHaveLength(0);
    });
  });
});
