# MCP Architecture Summary

## Core Architecture

**Client-server model:**
- **Host**: AI app (Claude Code, Claude Desktop) manages MCP clients
- **Client**: Maintains connection to MCP server
- **Server**: Provides tools, resources, prompts to clients

## Protocol

- **JSON-RPC 2.0** based
- Lifecycle: init -> capability negotiation -> operations -> terminate

## Tools Definition

```typescript
{
  name: "tool_name",
  title: "Display Name",
  description: "What it does",
  inputSchema: { /* JSON Schema */ },
  outputSchema: { /* optional */ }
}
```

## Tool Invocation Flow

1. `tools/list` - discover available tools
2. `tools/call` - invoke with arguments
3. Response: `{ content: [{ type: "text", text: "..." }], isError: false }`

## Transports

- **stdio**: Local subprocess, stdin/stdout JSON-RPC
- **Streamable HTTP**: Remote, HTTP POST + SSE

## TypeScript Implementation

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({
  name: 'server-name',
  version: '1.0.0',
});

server.registerTool(
  'tool-name',
  {
    title: 'Tool Title',
    description: 'Description',
    inputSchema: { param: z.string() }
  },
  async ({ param }) => ({
    content: [{ type: 'text', text: result }]
  })
);

// Stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);
```

## Key Packages

- `@modelcontextprotocol/sdk` - main SDK
- `zod` - schema validation

## Sources

- https://modelcontextprotocol.io/docs/concepts/architecture
- https://modelcontextprotocol.io/docs/concepts/tools
- https://github.com/modelcontextprotocol/typescript-sdk
