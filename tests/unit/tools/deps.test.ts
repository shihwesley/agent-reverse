import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vol } from 'memfs';
import { checkDeps, resolveDeps } from '../../../src/tools/deps.js';
import { createMockManifest, createMockCapability } from '../../mocks/factories.js';

// Mock fs/promises with memfs
vi.mock('fs/promises', async () => {
  const memfs = await import('memfs');
  return memfs.fs.promises;
});

describe('Dependencies Tool', () => {
  const manifestPath = '/project/agent-reverse.json';

  beforeEach(() => {
    vol.reset();
    vol.mkdirSync('/project', { recursive: true });
    vol.mkdirSync('/repo/skills', { recursive: true });
  });

  describe('checkDeps', () => {
    it('should report satisfied when all deps installed', async () => {
      const manifest = createMockManifest({
        capabilities: [
          createMockCapability({ id: 'parent', dependencies: ['child'] }),
          createMockCapability({ id: 'child', dependencies: [] }),
        ],
      });
      vol.writeFileSync(manifestPath, JSON.stringify(manifest));

      const result = await checkDeps('/project', 'parent');

      expect(result.satisfied).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('should detect missing dependencies', async () => {
      const manifest = createMockManifest({
        capabilities: [
          createMockCapability({ id: 'incomplete', dependencies: ['missing-dep'] }),
        ],
      });
      vol.writeFileSync(manifestPath, JSON.stringify(manifest));

      const result = await checkDeps('/project', 'incomplete');

      expect(result.satisfied).toBe(false);
      expect(result.missing).toContain('missing-dep');
    });

    it('should return not found for non-existent capability', async () => {
      const manifest = createMockManifest({ capabilities: [] });
      vol.writeFileSync(manifestPath, JSON.stringify(manifest));

      const result = await checkDeps('/project', 'non-existent');

      expect(result.satisfied).toBe(false);
      expect(result.missing[0]).toContain('not found');
    });

    it('should handle capability with no dependencies', async () => {
      const manifest = createMockManifest({
        capabilities: [
          createMockCapability({ id: 'standalone', dependencies: [] }),
        ],
      });
      vol.writeFileSync(manifestPath, JSON.stringify(manifest));

      const result = await checkDeps('/project', 'standalone');

      expect(result.satisfied).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('should handle multiple missing dependencies', async () => {
      const manifest = createMockManifest({
        capabilities: [
          createMockCapability({ id: 'many-deps', dependencies: ['dep1', 'dep2', 'dep3'] }),
        ],
      });
      vol.writeFileSync(manifestPath, JSON.stringify(manifest));

      const result = await checkDeps('/project', 'many-deps');

      expect(result.satisfied).toBe(false);
      expect(result.missing).toHaveLength(3);
      expect(result.missing).toContain('dep1');
      expect(result.missing).toContain('dep2');
      expect(result.missing).toContain('dep3');
    });
  });

  describe('resolveDeps', () => {
    it('should calculate install order for dependencies', async () => {
      // Only bottom is installed - mid and top need to be installed
      const manifest = createMockManifest({
        capabilities: [
          createMockCapability({ id: 'bottom', dependencies: [] }),
        ],
      });
      vol.writeFileSync(manifestPath, JSON.stringify(manifest));

      // Create skill file for 'top' that depends on 'mid'
      vol.writeFileSync('/repo/skills/top.md', `---
name: Top
dependencies: mid
---
# Top`);

      // Create skill file for 'mid' that depends on 'bottom'
      vol.mkdirSync('/repo/.claude/skills/mid', { recursive: true });
      vol.writeFileSync('/repo/.claude/skills/mid/SKILL.md', `---
name: Mid
dependencies: bottom
---
# Mid`);

      const result = await resolveDeps('/project', 'top', '/repo');

      expect(result.capability).toBe('top');
      // bottom is already installed, so only mid should be in install order
      expect(result.installOrder).toContain('mid');
    });

    it('should detect missing dependencies', async () => {
      const manifest = createMockManifest({
        capabilities: [
          createMockCapability({ id: 'needs-dep', dependencies: ['missing'] }),
        ],
      });
      vol.writeFileSync(manifestPath, JSON.stringify(manifest));

      const result = await resolveDeps('/project', 'needs-dep', '/repo');

      expect(result.missing).toContain('missing');
    });

    it('should read dependencies from skill file in repo', async () => {
      const manifest = createMockManifest({ capabilities: [] });
      vol.writeFileSync(manifestPath, JSON.stringify(manifest));

      vol.writeFileSync('/repo/skills/new-cap.md', `---
name: New Capability
dependencies: dep1, dep2
---
# New Capability`);

      const result = await resolveDeps('/project', 'new-cap', '/repo');

      expect(result.dependencies).toContain('dep1');
      expect(result.dependencies).toContain('dep2');
    });

    it('should detect circular dependencies', async () => {
      const manifest = createMockManifest({
        capabilities: [
          createMockCapability({ id: 'a', dependencies: ['b'] }),
          createMockCapability({ id: 'b', dependencies: ['a'] }),
        ],
      });
      vol.writeFileSync(manifestPath, JSON.stringify(manifest));

      const result = await resolveDeps('/project', 'a', '/repo');

      expect(result.hasCycle).toBe(true);
    });

    it('should skip already installed in install order', async () => {
      const manifest = createMockManifest({
        capabilities: [
          createMockCapability({ id: 'existing', dependencies: [] }),
          createMockCapability({ id: 'new', dependencies: ['existing'] }),
        ],
      });
      vol.writeFileSync(manifestPath, JSON.stringify(manifest));

      const result = await resolveDeps('/project', 'new', '/repo');

      // existing should not be in install order since it's installed
      expect(result.installOrder).not.toContain('existing');
    });

    it('should handle deep dependency chains', async () => {
      // No capabilities installed yet
      const manifest = createMockManifest({ capabilities: [] });
      vol.writeFileSync(manifestPath, JSON.stringify(manifest));

      // Create skill file for level1 with dependencies
      vol.writeFileSync('/repo/skills/level1.md', `---
name: Level 1
dependencies: level2
---
# Level 1`);

      // level2 depends on level3
      vol.writeFileSync('/repo/skills/level2.md', `---
name: Level 2
dependencies: level3
---
# Level 2`);

      // level3 depends on level4
      vol.writeFileSync('/repo/skills/level3.md', `---
name: Level 3
dependencies: level4
---
# Level 4`);

      // level4 has no deps
      vol.writeFileSync('/repo/skills/level4.md', `---
name: Level 4
---
# Level 4`);

      const result = await resolveDeps('/project', 'level1', '/repo');

      // Install order should have deps in correct order (deps first, then dependents)
      expect(result.dependencies).toContain('level2');
      expect(result.missing).toContain('level2');
    });
  });
});
