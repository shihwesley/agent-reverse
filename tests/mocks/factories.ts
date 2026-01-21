import type { Capability, Manifest, ParsedSkill, ExtractedMcpTool } from '../../src/types.js';

export function createMockCapability(overrides: Partial<Capability> = {}): Capability {
  return {
    id: 'test-capability',
    source: 'https://github.com/test/repo',
    commit: 'abc123',
    files: ['.claude/skills/test.md'],
    dependencies: [],
    status: 'installed',
    extractedFrom: 'skills/test.md',
    installedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockManifest(overrides: Partial<Manifest> = {}): Manifest {
  return {
    version: '1.0.0',
    targetAgent: 'claude-code',
    capabilities: [],
    superseded: [],
    ...overrides,
  };
}

export function createMockSkill(overrides: Partial<ParsedSkill> = {}): ParsedSkill {
  return {
    name: 'test-skill',
    description: 'A test skill',
    filePath: 'skills/test.md',
    frontmatter: {},
    content: '# Test Skill\n\nThis is a test.',
    ...overrides,
  };
}

export function createMockMcpTool(overrides: Partial<ExtractedMcpTool> = {}): ExtractedMcpTool {
  return {
    name: 'test_tool',
    description: 'A test MCP tool',
    inputSchema: {},
    filePath: 'src/server.ts',
    lineNumber: 1,
    ...overrides,
  };
}
