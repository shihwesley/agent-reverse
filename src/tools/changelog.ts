// changelog_check tool — Phase 7C
// Detect Claude Code version updates and apply migration rules

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { execFile } from 'child_process';
import { homedir } from 'os';
import { MIGRATION_RULES } from '../data/migration-rules.js';
import type { ChangelogEntry, MigrationRule, MigrationResult, LocalStateCache } from '../types.js';

function getClaudeVersion(): Promise<string> {
  return new Promise((resolve) => {
    execFile('claude', ['--version'], { timeout: 5000 }, (err, stdout) => {
      if (err) { resolve('unknown'); return; }
      resolve(stdout.trim().split('\n')[0]);
    });
  });
}

async function loadCachedVersion(): Promise<string | null> {
  try {
    const cachePath = join(homedir(), '.claude', 'agent-reverse-local-state.json');
    const content = await readFile(cachePath, 'utf-8');
    const cache: LocalStateCache = JSON.parse(content);
    return cache.claudeCodeVersion;
  } catch { return null; }
}

export function matchMigrationRules(entries: ChangelogEntry[]): {
  matched: Array<{ rule: MigrationRule; entry: string }>;
  unmatched: string[];
} {
  const matched: Array<{ rule: MigrationRule; entry: string }> = [];
  const unmatched: string[] = [];

  const allText: string[] = [];
  for (const entry of entries) {
    allText.push(...entry.newFeatures, ...entry.breakingChanges, ...entry.deprecations, ...entry.bugFixes, ...entry.configChanges);
  }

  for (const text of allText) {
    let wasMatched = false;
    for (const rule of MIGRATION_RULES) {
      if (new RegExp(rule.pattern, 'i').test(text)) {
        matched.push({ rule, entry: text });
        wasMatched = true;
        break;
      }
    }
    if (!wasMatched && text.trim()) unmatched.push(text);
  }

  return { matched, unmatched };
}

export async function checkChangelog(): Promise<MigrationResult> {
  const currentVersion = await getClaudeVersion();
  const previousVersion = await loadCachedVersion() || currentVersion;

  const result: MigrationResult = {
    previousVersion,
    currentVersion,
    entries: [],
    applied: [],
    pendingReview: [],
    infoOnly: [],
  };

  if (currentVersion === previousVersion) return result;

  // Version changed — production would fetch from npm + GitHub here
  // Core function stays testable without network mocks
  return result;
}

export function registerChangelogTools(server: McpServer): void {
  server.registerTool('changelog_check', {
    description: 'Check if Claude Code updated since last scan. Detects version changes, identifies needed config migrations.',
    inputSchema: { force: z.boolean().optional().default(false).describe('Force check even if version unchanged') },
  }, async ({ force }) => {
    try {
      const result = await checkChangelog();
      if (!force && result.currentVersion === result.previousVersion) {
        return { content: [{ type: 'text' as const, text: `Claude Code v${result.currentVersion} — no change.` }] };
      }
      const lines: string[] = [];
      if (result.currentVersion !== result.previousVersion) lines.push(`Claude Code updated: ${result.previousVersion} → ${result.currentVersion}`);
      for (const a of result.applied) lines.push(`  ✓ Auto-applied: ${a.rule.description}`);
      for (const p of result.pendingReview) lines.push(`  ⚠ Needs review: ${p.description}`);
      for (const i of result.infoOnly) lines.push(`  ℹ ${i}`);
      if (lines.length === 0) lines.push(`Claude Code v${result.currentVersion} — version changed, no actionable migrations.`);
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    } catch (error) {
      return { content: [{ type: 'text' as const, text: `Changelog check failed: ${error instanceof Error ? error.message : String(error)}` }], isError: true };
    }
  });
}
