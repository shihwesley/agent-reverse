import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vol } from 'memfs';
import { checkConflict, resolveConflict } from '../../../src/tools/conflict.js';
import { createMockManifest, createMockCapability } from '../../mocks/factories.js';

// Mock fs/promises with memfs
vi.mock('fs/promises', async () => {
  const memfs = await import('memfs');
  return memfs.fs.promises;
});

describe('Conflict Tool', () => {
  const manifestPath = '/project/agent-reverse.json';

  beforeEach(() => {
    vol.reset();
    vol.mkdirSync('/project/.claude/skills', { recursive: true });
  });

  describe('checkConflict', () => {
    it('should detect conflict when capability ID exists', async () => {
      const manifest = createMockManifest({
        capabilities: [createMockCapability({ id: 'existing-cap', source: 'https://github.com/test/repo' })],
      });
      vol.writeFileSync(manifestPath, JSON.stringify(manifest));

      const result = await checkConflict('/project', 'existing-cap');

      expect(result.hasConflict).toBe(true);
      expect(result.existing).toBeDefined();
      expect(result.existing?.id).toBe('existing-cap');
      expect(result.options).toContain('replace');
      expect(result.options).toContain('keep_both');
    });

    it('should offer synthesize option when sources differ', async () => {
      const manifest = createMockManifest({
        capabilities: [createMockCapability({ id: 'cap', source: 'https://github.com/test/repo1' })],
      });
      vol.writeFileSync(manifestPath, JSON.stringify(manifest));

      const result = await checkConflict('/project', 'cap', 'https://github.com/test/repo2');

      expect(result.hasConflict).toBe(true);
      expect(result.options).toContain('synthesize');
    });

    it('should return no conflict for new capability', async () => {
      const manifest = createMockManifest({ capabilities: [] });
      vol.writeFileSync(manifestPath, JSON.stringify(manifest));

      const result = await checkConflict('/project', 'new-cap');

      expect(result.hasConflict).toBe(false);
      expect(result.options).toHaveLength(0);
    });

    it('should return no conflict when ID not found', async () => {
      const manifest = createMockManifest({
        capabilities: [createMockCapability({ id: 'other-cap' })],
      });
      vol.writeFileSync(manifestPath, JSON.stringify(manifest));

      const result = await checkConflict('/project', 'non-existent');

      expect(result.hasConflict).toBe(false);
    });
  });

  describe('resolveConflict', () => {
    it('should replace existing with new (replace strategy)', async () => {
      const manifest = createMockManifest({
        capabilities: [createMockCapability({ id: 'old-cap', files: ['.claude/skills/old.md'] })],
        superseded: [],
      });
      vol.writeFileSync(manifestPath, JSON.stringify(manifest));
      vol.writeFileSync('/project/.claude/skills/old.md', '# Old Skill');

      const incoming = createMockCapability({ id: 'new-cap', files: ['.claude/skills/new.md'] });

      const result = await resolveConflict('/project', {
        existingId: 'old-cap',
        incomingId: 'new-cap',
        strategy: 'replace',
        incomingCapability: incoming,
      });

      expect(result.success).toBe(true);
      expect(result.result).toBe('replaced');
      expect(result.superseded).toContain('old-cap');

      const updated = JSON.parse(vol.readFileSync(manifestPath, 'utf8') as string);
      expect(updated.capabilities.some((c: any) => c.id === 'old-cap')).toBe(false);
      expect(updated.superseded.some((c: any) => c.id === 'old-cap')).toBe(true);
    });

    it('should keep both with renamed incoming (keep_both strategy)', async () => {
      const manifest = createMockManifest({
        capabilities: [createMockCapability({ id: 'existing' })],
      });
      vol.writeFileSync(manifestPath, JSON.stringify(manifest));

      const incoming = createMockCapability({ id: 'incoming', files: ['.claude/skills/incoming.md'] });

      const result = await resolveConflict('/project', {
        existingId: 'existing',
        incomingId: 'incoming',
        strategy: 'keep_both',
        incomingCapability: incoming,
      });

      expect(result.success).toBe(true);
      expect(result.result).toBe('renamed');

      const updated = JSON.parse(vol.readFileSync(manifestPath, 'utf8') as string);
      expect(updated.capabilities).toHaveLength(2);
      expect(updated.capabilities.some((c: any) => c.id === 'existing')).toBe(true);
    });

    it('should use custom name for keep_both strategy', async () => {
      const manifest = createMockManifest({
        capabilities: [createMockCapability({ id: 'existing' })],
      });
      vol.writeFileSync(manifestPath, JSON.stringify(manifest));

      const incoming = createMockCapability({ id: 'incoming' });

      const result = await resolveConflict('/project', {
        existingId: 'existing',
        incomingId: 'incoming',
        strategy: 'keep_both',
        mergedName: 'custom-name',
        incomingCapability: incoming,
      });

      expect(result.success).toBe(true);
      expect(result.newCapability?.id).toBe('custom-name');
    });

    it('should merge content (synthesize strategy)', async () => {
      vol.writeFileSync('/project/.claude/skills/existing.md', `---
name: Existing
---
# Existing Skill

- Point A from existing`);

      const manifest = createMockManifest({
        capabilities: [createMockCapability({
          id: 'existing',
          files: ['.claude/skills/existing.md'],
          extractedFrom: 'existing.md',
          dependencies: ['dep1'],
        })],
        superseded: [],
      });
      vol.writeFileSync(manifestPath, JSON.stringify(manifest));

      vol.writeFileSync('/project/.claude/skills/incoming.md', `---
name: Incoming
---
# Incoming Skill

- Point B from incoming`);

      const incoming = createMockCapability({
        id: 'incoming',
        files: ['.claude/skills/incoming.md'],
        extractedFrom: 'incoming.md',
        dependencies: ['dep2'],
      });

      const result = await resolveConflict('/project', {
        existingId: 'existing',
        incomingId: 'incoming',
        strategy: 'synthesize',
        incomingCapability: incoming,
      });

      expect(result.success).toBe(true);
      expect(result.result).toBe('synthesized');
      expect(result.superseded).toContain('existing');
      expect(result.synthesisReport).toContain('existing');

      // Check synthesized file was created
      const synthesizedPath = '/project/.claude/skills/existing-merged.md';
      expect(vol.existsSync(synthesizedPath)).toBe(true);
      const merged = vol.readFileSync(synthesizedPath, 'utf8') as string;
      expect(merged).toContain('Point A');
      expect(merged).toContain('Point B');
    });

    it('should fail gracefully when existing not found', async () => {
      const manifest = createMockManifest({ capabilities: [] });
      vol.writeFileSync(manifestPath, JSON.stringify(manifest));

      const result = await resolveConflict('/project', {
        existingId: 'non-existent',
        incomingId: 'incoming',
        strategy: 'replace',
      });

      expect(result.success).toBe(false);
    });

    it('should fail keep_both without incoming capability', async () => {
      const manifest = createMockManifest({
        capabilities: [createMockCapability({ id: 'existing' })],
      });
      vol.writeFileSync(manifestPath, JSON.stringify(manifest));

      const result = await resolveConflict('/project', {
        existingId: 'existing',
        incomingId: 'incoming',
        strategy: 'keep_both',
        // No incomingCapability provided
      });

      expect(result.success).toBe(false);
    });
  });
});
