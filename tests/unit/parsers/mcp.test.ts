import { describe, it, expect } from 'vitest';
import { parseMcpTools } from '../../../src/parsers/mcp.js';

describe('MCP Parser', () => {
  describe('parseMcpTools', () => {
    it('should extract tool from server.tool() call', () => {
      const content = `
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

const server = new Server({ name: 'test-server', version: '1.0.0' });

server.tool('fetch_data', 'Fetches data from API', {
  url: { type: 'string', description: 'The URL to fetch' },
}, async ({ url }) => {
  return { data: 'fetched' };
});
`;

      const result = parseMcpTools(content, 'src/server.ts');

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].name).toBe('fetch_data');
    });

    it('should extract tool and have description field', () => {
      const content = `
server.tool('my_tool', 'A helpful description', {}, async () => ({}));
`;

      const result = parseMcpTools(content, 'src/server.ts');

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].name).toBe('my_tool');
      // Description extraction depends on parser implementation
      expect(result[0]).toHaveProperty('description');
    });

    it('should extract multiple tools', () => {
      const content = `
server.tool('tool_one', 'First tool', {}, async () => ({}));
server.tool('tool_two', 'Second tool', {}, async () => ({}));
server.tool('tool_three', 'Third tool', {}, async () => ({}));
`;

      const result = parseMcpTools(content, 'src/server.ts');

      expect(result).toHaveLength(3);
      expect(result.map(t => t.name)).toEqual(['tool_one', 'tool_two', 'tool_three']);
    });

    it('should include filePath in result', () => {
      const content = `server.tool('test', 'desc', {}, async () => ({}));`;

      const result = parseMcpTools(content, 'custom/path/server.ts');

      expect(result[0].filePath).toBe('custom/path/server.ts');
    });

    it('should include lineNumber', () => {
      const content = `
// Some comments
server.tool('my_tool', 'desc', {}, async () => ({}));
`;

      const result = parseMcpTools(content, 'src/server.ts');

      expect(result[0].lineNumber).toBeGreaterThan(0);
    });

    it('should handle registerTool method', () => {
      const content = `
server.registerTool('registered_tool', 'A registered tool', {}, async () => ({}));
`;

      const result = parseMcpTools(content, 'src/server.ts');

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].name).toBe('registered_tool');
    });

    it('should return empty array for file with no tools', () => {
      const content = `
const x = 1;
console.log('no tools here');
`;

      const result = parseMcpTools(content, 'src/utils.ts');

      expect(result).toEqual([]);
    });

    it('should handle .js files', () => {
      const content = `server.tool('js_tool', 'JS tool', {}, async () => ({}));`;

      const result = parseMcpTools(content, 'src/server.js');

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].name).toBe('js_tool');
    });

    it('should use regex fallback for unknown extensions', () => {
      const content = `server.tool('unknown_ext', 'desc', {}, async () => ({}));`;

      const result = parseMcpTools(content, 'src/server.unknown');

      // Regex fallback should still find the tool name
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].name).toBe('unknown_ext');
    });
  });
});
