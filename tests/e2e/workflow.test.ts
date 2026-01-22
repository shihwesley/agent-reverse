import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

describe('E2E: CLI Workflow', () => {
  const testDir = '/tmp/agent-reverse-workflow-test';
  const cliPath = path.resolve(process.cwd(), 'dist/cli.js');

  beforeAll(() => {
    // Build project
    execSync('npm run build', { stdio: 'inherit', cwd: process.cwd() });
    fs.mkdirSync(testDir, { recursive: true });
  }, 60000);

  afterAll(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    // Clean test directory between tests
    const files = fs.readdirSync(testDir);
    for (const file of files) {
      fs.rmSync(path.join(testDir, file), { recursive: true, force: true });
    }
  });

  it('should show help with --help flag', () => {
    const result = spawnSync('node', [cliPath, '--help'], {
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('AgentReverse CLI');
    expect(result.stdout).toContain('analyze');
    expect(result.stdout).toContain('install');
    expect(result.stdout).toContain('sync');
  });

  it('should list installed capabilities (empty manifest)', () => {
    const result = spawnSync('node', [cliPath, 'list', '--json'], {
      encoding: 'utf8',
      cwd: testDir,
    });

    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output).toEqual([]);
  });

  it('should list capabilities from existing manifest', () => {
    // Create manifest with a capability
    fs.writeFileSync(path.join(testDir, 'agent-reverse.json'), JSON.stringify({
      version: '1.0.0',
      targetAgent: 'claude-code',
      capabilities: [{
        id: 'test-cap',
        name: 'Test Capability',
        source: 'https://github.com/test/repo',
        commit: 'abc123def456',
        installedAt: new Date().toISOString(),
        files: ['.claude/skills/test.md'],
        status: 'installed',
      }],
      superseded: [],
    }));

    const result = spawnSync('node', [cliPath, 'list', '--json'], {
      encoding: 'utf8',
      cwd: testDir,
    });

    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output).toHaveLength(1);
    expect(output[0].id).toBe('test-cap');
  });

  it('should run audit command', () => {
    // Create manifest
    fs.writeFileSync(path.join(testDir, 'agent-reverse.json'), JSON.stringify({
      version: '1.0.0',
      targetAgent: 'claude-code',
      capabilities: [],
      superseded: [],
    }));

    const result = spawnSync('node', [cliPath, 'audit', '--json'], {
      encoding: 'utf8',
      cwd: testDir,
    });

    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output.capabilities).toBeDefined();
  });

  it('should detect workspace with --workspace flag', () => {
    // Create manifest in testDir
    fs.writeFileSync(path.join(testDir, 'agent-reverse.json'), JSON.stringify({
      version: '1.0.0',
      targetAgent: 'claude-code',
      capabilities: [{
        id: 'workspace-test',
        name: 'Workspace Test',
        source: 'https://github.com/test/repo',
        commit: 'def456',
        installedAt: new Date().toISOString(),
        files: [],
        status: 'installed',
      }],
      superseded: [],
    }));

    // Run from different directory but specify workspace
    const result = spawnSync('node', [cliPath, 'list', '--json', '--workspace', testDir], {
      encoding: 'utf8',
      cwd: process.cwd(), // Not testDir
    });

    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout);
    expect(output).toHaveLength(1);
    expect(output[0].id).toBe('workspace-test');
  });

  // Network tests - skip in CI without E2E_NETWORK env var
  it.skipIf(!process.env.E2E_NETWORK)('should analyze a GitHub repository (network)', () => {
    const result = spawnSync('node', [cliPath, 'analyze', 'https://github.com/octocat/Hello-World', '--json'], {
      encoding: 'utf8',
      timeout: 60000,
    });

    // Should not crash
    expect([0, 1]).toContain(result.status);
  }, 60000);

  it.skipIf(!process.env.E2E_NETWORK)('should check for updates (network)', () => {
    // Create manifest with capability pointing to real repo
    fs.writeFileSync(path.join(testDir, 'agent-reverse.json'), JSON.stringify({
      version: '1.0.0',
      targetAgent: 'claude-code',
      capabilities: [{
        id: 'hello-world-test',
        name: 'Hello World',
        source: 'https://github.com/octocat/Hello-World',
        commit: 'old-commit-hash',
        installedAt: new Date().toISOString(),
        files: [],
        status: 'installed',
      }],
      superseded: [],
    }));

    const result = spawnSync('node', [cliPath, 'check-updates', '--json'], {
      encoding: 'utf8',
      cwd: testDir,
      timeout: 60000,
    });

    // May fail due to network issues but should not crash
    expect([0, 1]).toContain(result.status);
  }, 60000);
});
