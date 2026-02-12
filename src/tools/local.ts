// local_scan + local_optimize tools — Phase 7A
// Scan and optimize the local Claude Code environment

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readFile, readdir, stat, writeFile } from 'fs/promises';
import { join, basename } from 'path';
import { execFile } from 'child_process';
import { homedir } from 'os';
import { createHash } from 'crypto';
import { parseSkillFile } from '../parsers/skill.js';
import type {
  LocalState,
  LocalStateCache,
  LocalSkillInfo,
  LocalHookInfo,
  LocalMcpServer,
  OptimizationFinding,
  OptimizeResult,
} from '../types.js';

const CACHE_PATH = () => join(homedir(), '.claude', 'agent-reverse-local-state.json');

function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex').substring(0, 16);
}

function getClaudeVersion(): Promise<string> {
  return new Promise((resolve) => {
    execFile('claude', ['--version'], { timeout: 5000 }, (err, stdout) => {
      if (err) { resolve('unknown'); return; }
      resolve(stdout.trim().split('\n')[0]);
    });
  });
}

async function safeReadJson(path: string): Promise<Record<string, unknown>> {
  try {
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content);
  } catch { return {}; }
}

async function safeReadDir(path: string): Promise<string[]> {
  try { return await readdir(path); }
  catch { return []; }
}

// Scan directory-based skills: each subdirectory contains SKILL.md
async function scanSkillsDir(dir: string, userInvocable: boolean): Promise<LocalSkillInfo[]> {
  const entries = await safeReadDir(dir);
  const skills: LocalSkillInfo[] = [];

  for (const entry of entries) {
    const entryPath = join(dir, entry);

    // New convention: subdirectory with SKILL.md
    const skillFile = join(entryPath, 'SKILL.md');
    try {
      const fileStat = await stat(skillFile);
      if (fileStat.isFile()) {
        const content = await readFile(skillFile, 'utf-8');
        const parsed = parseSkillFile(content, skillFile);
        skills.push({
          name: parsed?.name || entry,
          path: skillFile,
          userInvocable,
          size: fileStat.size,
          modifiedAt: fileStat.mtime.toISOString(),
        });
        continue;
      }
    } catch { /* not a directory skill, try flat file fallback */ }

    // Legacy flat file fallback (for old .md files still in skills/)
    if (entry.endsWith('.md')) {
      try {
        const content = await readFile(entryPath, 'utf-8');
        const fileStat = await stat(entryPath);
        const parsed = parseSkillFile(content, entryPath);
        skills.push({
          name: parsed?.name || basename(entry, '.md'),
          path: entryPath,
          userInvocable,
          size: fileStat.size,
          modifiedAt: fileStat.mtime.toISOString(),
        });
      } catch {
        skills.push({
          name: basename(entry, '.md'),
          path: entryPath,
          userInvocable,
          size: 0,
          modifiedAt: new Date().toISOString(),
        });
      }
    }
  }
  return skills;
}

// Scan legacy flat commands directory (backward compat, read-only)
async function scanCommandsDir(dir: string): Promise<LocalSkillInfo[]> {
  const files = await safeReadDir(dir);
  const skills: LocalSkillInfo[] = [];
  for (const file of files) {
    if (!file.endsWith('.md')) continue;
    const fullPath = join(dir, file);
    try {
      const content = await readFile(fullPath, 'utf-8');
      const fileStat = await stat(fullPath);
      const parsed = parseSkillFile(content, fullPath);
      skills.push({
        name: parsed?.name || basename(file, '.md'),
        path: fullPath,
        userInvocable: true,
        size: fileStat.size,
        modifiedAt: fileStat.mtime.toISOString(),
      });
    } catch {
      skills.push({
        name: basename(file, '.md'),
        path: fullPath,
        userInvocable: true,
        size: 0,
        modifiedAt: new Date().toISOString(),
      });
    }
  }
  return skills;
}

function parseHooksFromSettings(settings: Record<string, unknown>): LocalHookInfo[] {
  const hooks: LocalHookInfo[] = [];
  const hooksObj = settings.hooks as Record<string, Array<{ command: string }>> | undefined;
  if (!hooksObj || typeof hooksObj !== 'object') return hooks;
  for (const [event, entries] of Object.entries(hooksObj)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (entry.command) hooks.push({ event, command: entry.command, path: '' });
    }
  }
  return hooks;
}

function parseMcpServers(config: Record<string, unknown>): LocalMcpServer[] {
  const servers: LocalMcpServer[] = [];
  const serversObj = (config.servers || config.mcpServers || config) as Record<string, Record<string, unknown>>;
  if (!serversObj || typeof serversObj !== 'object') return servers;
  for (const [name, serverConfig] of Object.entries(serversObj)) {
    if (typeof serverConfig !== 'object' || serverConfig === null) continue;
    // Skip non-server keys like "version" or "description" at the top level
    if (!('transport' in serverConfig) && !('command' in serverConfig) && !('url' in serverConfig)) continue;
    servers.push({
      name,
      transport: (serverConfig.transport as string) || 'unknown',
      command: serverConfig.command as string | undefined,
      url: serverConfig.url as string | undefined,
    });
  }
  return servers;
}

export async function scanLocalEnvironment(): Promise<LocalState> {
  const home = homedir();
  const claudeDir = join(home, '.claude');

  const [version, settings, keybindings, mcpConfig] = await Promise.all([
    getClaudeVersion(),
    safeReadJson(join(claudeDir, 'settings.json')),
    safeReadJson(join(claudeDir, 'keybindings.json')),
    safeReadJson(join(claudeDir, 'mcp_servers.json')),
  ]);

  const [skills, commands, agents] = await Promise.all([
    scanSkillsDir(join(claudeDir, 'skills'), false),
    scanCommandsDir(join(claudeDir, 'commands')),
    safeReadDir(join(claudeDir, 'agents')),
  ]);

  return {
    claudeCodeVersion: version,
    settings,
    keybindings,
    skills,
    commands,
    hooks: parseHooksFromSettings(settings),
    mcpServers: parseMcpServers(mcpConfig),
    agents: agents.filter(a => a.endsWith('.md') || a.endsWith('.json')),
  };
}

export async function cacheLocalState(state: LocalState): Promise<void> {
  const fileHashes: Record<string, string> = {};
  for (const skill of [...state.skills, ...state.commands]) {
    try {
      const content = await readFile(skill.path, 'utf-8');
      fileHashes[skill.path] = hashContent(content);
    } catch { /* skip */ }
  }
  const cache: LocalStateCache = {
    version: '1.0',
    scannedAt: new Date().toISOString(),
    claudeCodeVersion: state.claudeCodeVersion,
    fileHashes,
    state,
  };
  await writeFile(CACHE_PATH(), JSON.stringify(cache, null, 2));
}

export async function loadCachedState(): Promise<LocalStateCache | null> {
  try {
    const content = await readFile(CACHE_PATH(), 'utf-8');
    return JSON.parse(content);
  } catch { return null; }
}

export async function optimizeLocalEnvironment(state: LocalState): Promise<OptimizeResult> {
  const findings: OptimizationFinding[] = [];
  const settingsStr = JSON.stringify(state.settings);
  const hookCommands = state.hooks.map(h => h.command).join(' ');

  // Dead skills: not referenced anywhere in settings or hooks
  for (const skill of state.skills) {
    const referenced = settingsStr.includes(skill.name) || hookCommands.includes(skill.name);
    if (!referenced) {
      findings.push({
        type: 'dead_skill',
        severity: 'info',
        description: `Skill "${skill.name}" is not referenced in settings or hooks`,
        autoFixable: false,
      });
    }
  }

  // Deprecated settings
  const DEPRECATED_SETTINGS: Record<string, string> = {
    allowedTools: 'permissions.allow',
  };
  for (const [oldKey, newKey] of Object.entries(DEPRECATED_SETTINGS)) {
    if (oldKey in state.settings) {
      findings.push({
        type: 'deprecated_setting',
        severity: 'safe',
        description: `Setting "${oldKey}" is deprecated, use "${newKey}"`,
        autoFixable: true,
      });
    }
  }

  // Duplicate scope: same name in both skills/ and commands/
  const skillNames = new Set(state.skills.map(s => s.name));
  const cmdNames = new Set(state.commands.map(c => c.name));
  for (const name of [...skillNames].filter(s => cmdNames.has(s))) {
    findings.push({
      type: 'duplicate_scope',
      severity: 'info',
      description: `"${name}" exists in both skills/ and legacy commands/`,
      autoFixable: false,
    });
  }

  return {
    findings,
    applied: findings.filter(f => f.autoFixable && f.severity === 'safe').length,
    needsReview: findings.filter(f => f.severity === 'breaking').length,
  };
}

export function registerLocalTools(server: McpServer): void {
  server.registerTool('local_scan', {
    description: 'Scan the local Claude Code environment: settings, skills, hooks, MCP servers, binary version.',
    inputSchema: {
      forceRescan: z.boolean().optional().default(false).describe('Force full rescan even if cache is fresh'),
    },
  }, async ({ forceRescan }) => {
    try {
      if (!forceRescan) {
        const cached = await loadCachedState();
        if (cached) {
          const s = cached.state;
          return {
            content: [{
              type: 'text' as const,
              text: `${s.skills.length} skills, ${s.commands.length} commands, ${s.hooks.length} hooks, ${s.mcpServers.length} MCP servers, binary v${s.claudeCodeVersion} (cached ${cached.scannedAt})`,
            }],
          };
        }
      }
      const state = await scanLocalEnvironment();
      await cacheLocalState(state);
      return {
        content: [{
          type: 'text' as const,
          text: `${state.skills.length} skills, ${state.commands.length} commands, ${state.hooks.length} hooks, ${state.mcpServers.length} MCP servers, binary v${state.claudeCodeVersion} (fresh scan)`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: `Local scan failed: ${error instanceof Error ? error.message : String(error)}`,
        }],
        isError: true,
      };
    }
  });

  server.registerTool('local_optimize', {
    description: 'Run optimization rules on local Claude Code environment. Detects dead skills, deprecated settings, duplicate scopes.',
    inputSchema: {
      autoApply: z.boolean().optional().default(true).describe('Auto-apply safe fixes (creates backup first)'),
    },
  }, async ({ autoApply: _autoApply }) => {
    try {
      const state = await scanLocalEnvironment();
      const result = await optimizeLocalEnvironment(state);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            findingsCount: result.findings.length,
            findings: result.findings,
            applied: result.applied,
            needsReview: result.needsReview,
          }, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: 'text' as const,
          text: `Optimize failed: ${error instanceof Error ? error.message : String(error)}`,
        }],
        isError: true,
      };
    }
  });
}
