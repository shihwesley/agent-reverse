#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// Tool imports (Phase 1)
import { registerFetchTool } from './tools/fetch.js';
import { registerAnalyzeTool } from './tools/analyze.js';
import { registerManifestTools } from './tools/manifest.js';
// import { registerInstallTool } from './tools/install.js';

const server = new McpServer({
  name: 'agent-reverse',
  version: '0.1.0',
});

// Register tools
registerFetchTool(server);
registerAnalyzeTool(server);
registerManifestTools(server);
// registerInstallTool(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('AgentReverse MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
