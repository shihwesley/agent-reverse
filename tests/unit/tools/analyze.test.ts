import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vol } from 'memfs';

// Mock fs/promises with memfs
vi.mock('fs/promises', async () => {
  const memfs = await import('memfs');
  return memfs.fs.promises;
});

// Mock the MCP parser since it uses tree-sitter which is hard to mock
vi.mock('../../../src/parsers/mcp.js', () => ({
  scanDirectoryForMcpTools: vi.fn().mockResolvedValue([]),
  toAnalyzeFormat: vi.fn((tools) => tools),
}));

import { analyzeRepo } from '../../../src/tools/analyze.js';

describe('Analyze Tool', () => {
  beforeEach(() => {
    vol.reset();
  });

  describe('analyzeRepo', () => {
    it('should detect skills in skill directories', async () => {
      vol.fromJSON({
        '/repo/skills/my-skill.md': `---
name: my-skill
description: A test skill
---

# My Skill

Content here.`,
      });

      const result = await analyzeRepo('/repo');

      expect(result.skills.length).toBeGreaterThan(0);
      expect(result.skills[0].name).toBe('my-skill');
    });

    it('should parse README for metadata', async () => {
      vol.fromJSON({
        '/repo/README.md': `# Test Project

## Installation

\`\`\`bash
npm install test-package
\`\`\`

## Dependencies

- lodash
- express`,
      });

      const result = await analyzeRepo('/repo');

      expect(result.readme).toBeDefined();
      expect(result.readme).toContain('# Test Project');
    });

    it('should extract dependencies from README', async () => {
      vol.fromJSON({
        '/repo/README.md': `# Project

## Dependencies

- lodash
- express`,
      });

      const result = await analyzeRepo('/repo');

      expect(result.dependencies).toContain('lodash');
    });

    it('should extract dependencies from package.json', async () => {
      vol.fromJSON({
        '/repo/package.json': JSON.stringify({
          name: 'test-repo',
          dependencies: {
            lodash: '^4.0.0',
            express: '^5.0.0',
          },
        }),
      });

      const result = await analyzeRepo('/repo');

      expect(result.dependencies).toContain('lodash');
      expect(result.dependencies).toContain('express');
    });

    it('should detect MCP server plugin', async () => {
      vol.fromJSON({
        '/repo/package.json': JSON.stringify({
          name: 'mcp-test',
          dependencies: {
            '@modelcontextprotocol/sdk': '^1.0.0',
          },
        }),
      });

      const result = await analyzeRepo('/repo');

      expect(result.plugins).toContain('mcp-server');
    });

    it('should handle repo with no capabilities', async () => {
      vol.fromJSON({
        '/repo/README.md': '# Empty Project',
      });

      const result = await analyzeRepo('/repo');

      expect(result.skills).toHaveLength(0);
      expect(result.tools).toHaveLength(0);
    });

    it('should detect multiple skill files', async () => {
      vol.fromJSON({
        '/repo/skills/skill1.md': `---
name: skill1
---
Content 1`,
        '/repo/skills/skill2.md': `---
name: skill2
---
Content 2`,
      });

      const result = await analyzeRepo('/repo');

      expect(result.skills).toHaveLength(2);
    });

    it('should skip hidden directories and node_modules', async () => {
      vol.fromJSON({
        '/repo/.hidden/skill.md': `---
name: hidden-skill
---
Hidden`,
        '/repo/node_modules/pkg/skill.md': `---
name: node-skill
---
Node`,
        '/repo/skills/visible.md': `---
name: visible-skill
---
Visible`,
      });

      const result = await analyzeRepo('/repo');

      expect(result.skills).toHaveLength(1);
      expect(result.skills[0].name).toBe('visible-skill');
    });

    it('should handle invalid package.json gracefully', async () => {
      vol.fromJSON({
        '/repo/package.json': 'not valid json',
        '/repo/README.md': '# Test',
      });

      const result = await analyzeRepo('/repo');

      // Should not throw
      expect(result).toBeDefined();
    });
  });
});
