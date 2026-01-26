import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { McpTestClient } from './helpers/mcp-client.js';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

describe('E2E: MCP Server', () => {
  let client: McpTestClient;
  const testDir = '/tmp/agent-reverse-e2e-test';

  beforeAll(async () => {
    // Build the project first
    execSync('npm run build', { stdio: 'inherit', cwd: process.cwd() });

    // Create test directory
    fs.mkdirSync(testDir, { recursive: true });

    // Start MCP server
    client = new McpTestClient();
    await client.start();
  }, 60000);

  afterAll(async () => {
    await client.stop();
    // Cleanup test directory
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    // Clean test directory between tests
    const files = fs.readdirSync(testDir);
    for (const file of files) {
      fs.rmSync(path.join(testDir, file), { recursive: true, force: true });
    }
  });

  it('should expose all 26 MCP tools', async () => {
    const tools = await client.listTools();
    const toolNames = tools.map(t => t.name);

    const expectedTools = [
      // Fetch tools
      'repo_fetch', 'repo_cleanup',
      // Analyze tool
      'repo_analyze',
      // Manifest tools
      'manifest_add', 'manifest_remove', 'manifest_list', 'manifest_get',
      // Install tool
      'install_capability',
      // Sync tools
      'manifest_sync', 'manifest_check_updates',
      // Observer tools
      'observer_log', 'observer_get_patterns', 'observer_clear',
      // Suggester tools
      'suggester_check', 'suggester_add_repo', 'suggester_list_repos',
      // Audit tool
      'manifest_audit',
      // Conflict tools
      'conflict_check', 'conflict_resolve',
      // Deps tools
      'deps_check', 'deps_resolve',
      // Web tools
      'web_interpret', 'web_fetch',
      // Backup tools
      'backup_create', 'backup_restore', 'backup_list',
    ];

    for (const tool of expectedTools) {
      expect(toolNames, `Missing tool: ${tool}`).toContain(tool);
    }
    expect(toolNames).toHaveLength(26);
  });

  it('should execute manifest_list tool on empty project', async () => {
    const result = await client.callTool('manifest_list', {
      workspacePath: testDir,
    }) as { content: Array<{ type: string; text: string }> };

    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');

    const data = JSON.parse(result.content[0].text);
    expect(data.capabilities).toBeDefined();
    expect(Array.isArray(data.capabilities)).toBe(true);
  });

  it('should execute manifest_audit tool', async () => {
    // Create a project structure with orphan file
    fs.mkdirSync(path.join(testDir, '.claude', 'skills'), { recursive: true });
    fs.writeFileSync(path.join(testDir, '.claude', 'skills', 'orphan.md'), '# Orphan');
    fs.writeFileSync(path.join(testDir, 'agent-reverse.json'), JSON.stringify({
      version: '1.0.0',
      targetAgent: 'claude-code',
      capabilities: [],
      superseded: [],
    }));

    const result = await client.callTool('manifest_audit', {
      workspacePath: testDir,
    }) as { content: Array<{ type: string; text: string }> };

    expect(result.content).toBeDefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.bloat).toBeDefined();
    expect(data.bloat.some((b: { reason: string }) => b.reason === 'orphan')).toBe(true);
  });

  it('should execute observer tools', async () => {
    // Create manifest for observer
    fs.writeFileSync(path.join(testDir, 'agent-reverse.json'), JSON.stringify({
      version: '1.0.0',
      targetAgent: 'claude-code',
      capabilities: [],
      superseded: [],
    }));

    // Log an event
    const logResult = await client.callTool('observer_log', {
      workspacePath: testDir,
      eventType: 'test_event',
      trigger: 'test_trigger',
      context: { key: 'value' },
    }) as { content: Array<{ type: string; text: string }> };

    expect(logResult.content).toBeDefined();

    // Get patterns
    const patternsResult = await client.callTool('observer_get_patterns', {
      workspacePath: testDir,
    }) as { content: Array<{ type: string; text: string }> };

    expect(patternsResult.content).toBeDefined();

    // Clear observer data
    const clearResult = await client.callTool('observer_clear', {
      workspacePath: testDir,
    }) as { content: Array<{ type: string; text: string }> };

    expect(clearResult.content).toBeDefined();
  });

  // Network tests - skip in CI without E2E_NETWORK env var
  it.skipIf(!process.env.E2E_NETWORK)('should execute repo_fetch tool (network)', async () => {
    const result = await client.callTool('repo_fetch', {
      url: 'https://github.com/octocat/Hello-World',
    }) as { content: Array<{ type: string; text: string }> };

    expect(result.content).toBeDefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.cloneId).toBeDefined();
    expect(data.commit).toBeDefined();

    // Cleanup
    await client.callTool('repo_cleanup', { cloneId: data.cloneId });
  }, 60000);
});
