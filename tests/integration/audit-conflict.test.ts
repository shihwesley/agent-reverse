import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vol } from 'memfs';

// Mock fs/promises with memfs
vi.mock('fs/promises', async () => {
  const memfs = await import('memfs');
  return memfs.fs.promises;
});

// Import after mocks
import { runAudit } from '../../src/tools/audit.js';
import { checkConflict, resolveConflict } from '../../src/tools/conflict.js';
import { createMockManifest, createMockCapability } from '../mocks/factories.js';

describe('Integration: Audit → Conflict Resolution Flow', () => {
  beforeEach(() => {
    vol.reset();
    vol.mkdirSync('/project/.claude/skills', { recursive: true });
  });

  it('should detect duplicates via audit and resolve', async () => {
    // Setup: Two capabilities with overlapping git functionality
    vol.writeFileSync('/project/.claude/skills/git1.md', `---
name: Git Helper
description: Git utilities
---
# Git Helper
Working with git commits and branches`);
    vol.writeFileSync('/project/.claude/skills/git2.md', `---
name: Git Utils
description: More git utilities
---
# Git Utils
Working with git merges and commits`);

    const manifest = createMockManifest({
      capabilities: [
        createMockCapability({ id: 'git-1', files: ['.claude/skills/git1.md'] }),
        createMockCapability({ id: 'git-2', files: ['.claude/skills/git2.md'] }),
      ],
    });
    vol.writeFileSync('/project/agent-reverse.json', JSON.stringify(manifest));

    // Audit detects duplicates
    const auditResult = await runAudit('/project');
    expect(auditResult.duplicates.some(d => d.functionality === 'git-operations')).toBe(true);

    // Resolve conflict by replacing git-1 with git-2
    const incoming = createMockCapability({ id: 'git-2-new', files: ['.claude/skills/git2.md'] });
    await resolveConflict('/project', {
      existingId: 'git-1',
      incomingId: 'git-2-new',
      strategy: 'replace',
      incomingCapability: incoming,
    });

    // Verify git-1 moved to superseded
    const updatedManifest = JSON.parse(vol.readFileSync('/project/agent-reverse.json', 'utf8') as string);
    expect(updatedManifest.superseded.some((c: any) => c.id === 'git-1')).toBe(true);
  });

  it('should detect orphans and allow cleanup', async () => {
    // Setup: Orphaned file not in manifest
    vol.writeFileSync('/project/.claude/skills/orphan.md', '# Orphan Skill');
    vol.writeFileSync('/project/agent-reverse.json', JSON.stringify(createMockManifest()));

    // Audit finds orphan
    const auditResult = await runAudit('/project');
    expect(auditResult.bloat.some(b => b.reason === 'orphan' && b.id.includes('orphan.md'))).toBe(true);

    // Clean orphan manually
    vol.unlinkSync('/project/.claude/skills/orphan.md');

    // Re-audit shows clean
    const reaudit = await runAudit('/project');
    expect(reaudit.bloat.filter(b => b.reason === 'orphan')).toHaveLength(0);
  });

  it('should check conflict before install', async () => {
    // Setup: Existing capability
    const manifest = createMockManifest({
      capabilities: [
        createMockCapability({ id: 'existing-cap', source: 'https://github.com/old/repo' }),
      ],
    });
    vol.writeFileSync('/project/agent-reverse.json', JSON.stringify(manifest));

    // Check for conflict
    const conflictResult = await checkConflict('/project', 'existing-cap', 'https://github.com/new/repo');

    expect(conflictResult.hasConflict).toBe(true);
    expect(conflictResult.options).toContain('replace');
    expect(conflictResult.options).toContain('synthesize'); // Different sources
  });

  it('should synthesize conflicting capabilities', async () => {
    // Setup: Existing capability with skill file
    vol.writeFileSync('/project/.claude/skills/existing.md', `---
name: Existing
---
# Existing Skill
Point A from existing`);

    const manifest = createMockManifest({
      capabilities: [
        createMockCapability({
          id: 'existing',
          files: ['.claude/skills/existing.md'],
          extractedFrom: '.claude/skills/existing.md',
        }),
      ],
      superseded: [],
    });
    vol.writeFileSync('/project/agent-reverse.json', JSON.stringify(manifest));

    // Incoming capability
    vol.writeFileSync('/project/.claude/skills/incoming.md', `---
name: Incoming
---
# Incoming Skill
Point B from incoming`);

    const incoming = createMockCapability({
      id: 'incoming',
      files: ['.claude/skills/incoming.md'],
      extractedFrom: '.claude/skills/incoming.md',
    });

    // Resolve via synthesize
    const result = await resolveConflict('/project', {
      existingId: 'existing',
      incomingId: 'incoming',
      strategy: 'synthesize',
      incomingCapability: incoming,
    });

    expect(result.success).toBe(true);
    expect(result.result).toBe('synthesized');

    // Verify merged file exists
    expect(vol.existsSync('/project/.claude/skills/existing-merged.md')).toBe(true);
  });
});
