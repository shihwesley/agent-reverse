import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vol } from 'memfs';

vi.mock('fs/promises', async () => {
  const memfs = await import('memfs');
  return memfs.fs.promises;
});

vi.mock('child_process', () => ({
  execFile: vi.fn((_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
    cb(null, '2.1.39\n', '');
  }),
}));

vi.mock('os', () => ({
  homedir: () => '/home/user',
}));

import { scanLocalEnvironment, optimizeLocalEnvironment } from '../../../src/tools/local.js';

describe('Local Scanner', () => {
  beforeEach(() => {
    vol.reset();
    vol.mkdirSync('/home/user/.claude/skills', { recursive: true });
    vol.mkdirSync('/home/user/.claude/commands', { recursive: true });
    vol.writeFileSync('/home/user/.claude/settings.json', JSON.stringify({
      permissions: { allow: ['Read', 'Write'] },
    }));
  });

  it('should scan and return LocalState with skills inventory', async () => {
    vol.writeFileSync('/home/user/.claude/skills/test-skill.md', `---
name: test-skill
description: A test
---
Content`);

    const state = await scanLocalEnvironment();
    expect(state.skills).toHaveLength(1);
    expect(state.skills[0].name).toBe('test-skill');
    expect(state.claudeCodeVersion).toBe('2.1.39');
  });

  it('should scan commands directory', async () => {
    vol.writeFileSync('/home/user/.claude/commands/my-cmd.md', `---
name: my-cmd
description: My command
user-invocable: true
---
Do things`);

    const state = await scanLocalEnvironment();
    expect(state.commands).toHaveLength(1);
    expect(state.commands[0].userInvocable).toBe(true);
  });

  it('should parse MCP server config', async () => {
    vol.writeFileSync('/home/user/.claude/mcp_servers.json', JSON.stringify({
      servers: {
        'context7': { transport: 'stdio', command: 'npx context7' },
      }
    }));

    const state = await scanLocalEnvironment();
    expect(state.mcpServers).toHaveLength(1);
    expect(state.mcpServers[0].name).toBe('context7');
  });

  it('should return empty arrays when directories are missing', async () => {
    vol.reset();
    vol.mkdirSync('/home/user/.claude', { recursive: true });
    vol.writeFileSync('/home/user/.claude/settings.json', '{}');

    const state = await scanLocalEnvironment();
    expect(state.skills).toHaveLength(0);
    expect(state.commands).toHaveLength(0);
    expect(state.hooks).toHaveLength(0);
  });

  describe('optimizeLocalEnvironment', () => {
    it('should detect deprecated settings', async () => {
      vol.reset();
      vol.mkdirSync('/home/user/.claude/skills', { recursive: true });
      vol.mkdirSync('/home/user/.claude/commands', { recursive: true });
      vol.writeFileSync('/home/user/.claude/settings.json', JSON.stringify({
        allowedTools: ['Read', 'Write'],
      }));

      const state = await scanLocalEnvironment();
      const result = await optimizeLocalEnvironment(state);
      expect(result.findings.some(f => f.type === 'deprecated_setting')).toBe(true);
    });
  });
});
