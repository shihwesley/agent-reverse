import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as path from 'path';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export class McpTestClient extends EventEmitter {
  private process: ChildProcess | null = null;
  private buffer: string = '';
  private requestId: number = 0;
  private pendingRequests: Map<string | number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }> = new Map();

  async start(): Promise<void> {
    const serverPath = path.resolve(process.cwd(), 'dist/server.js');

    this.process = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd(),
    });

    this.process.stdout?.on('data', (data) => {
      this.buffer += data.toString();
      this.processBuffer();
    });

    this.process.stderr?.on('data', (data) => {
      // Server logs to stderr - ignore unless debugging
      const msg = data.toString();
      if (!msg.includes('running on stdio')) {
        console.error('MCP Server:', msg);
      }
    });

    this.process.on('error', (err) => {
      this.emit('error', err);
    });

    this.process.on('exit', (code) => {
      this.emit('exit', code);
    });

    // Wait for server to be ready
    await new Promise<void>((resolve) => setTimeout(resolve, 500));

    // Initialize the MCP connection
    await this.initialize();
  }

  private processBuffer(): void {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.trim()) {
        try {
          const message = JSON.parse(line) as JsonRpcResponse;
          this.handleResponse(message);
        } catch {
          // Not JSON, ignore
        }
      }
    }
  }

  private handleResponse(message: JsonRpcResponse): void {
    if (message.id !== undefined) {
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        this.pendingRequests.delete(message.id);
        if (message.error) {
          pending.reject(new Error(message.error.message));
        } else {
          pending.resolve(message.result);
        }
      }
    }
    this.emit('message', message);
  }

  private async sendRequest(method: string, params?: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      const request: JsonRpcRequest = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      this.pendingRequests.set(id, { resolve, reject });
      this.process?.stdin?.write(JSON.stringify(request) + '\n');

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timeout: ${method}`));
        }
      }, 30000);
    });
  }

  private async initialize(): Promise<void> {
    await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'test-client', version: '1.0.0' },
    });

    // Send initialized notification (no response expected)
    const notification = {
      jsonrpc: '2.0' as const,
      method: 'notifications/initialized',
    };
    this.process?.stdin?.write(JSON.stringify(notification) + '\n');
  }

  async listTools(): Promise<Array<{ name: string; description?: string }>> {
    const result = await this.sendRequest('tools/list', {}) as {
      tools: Array<{ name: string; description?: string }>;
    };
    return result.tools || [];
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const result = await this.sendRequest('tools/call', {
      name,
      arguments: args,
    });
    return result;
  }

  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.pendingRequests.clear();
  }
}
