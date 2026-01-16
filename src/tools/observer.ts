// observer tools - Phase 3
// Track workflow patterns and friction points

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';

const CACHE_FILE = 'workflow-cache.json';
const MAX_AGE_DAYS = 30;

// Event types
type EventType = 'tool_invocation' | 'error' | 'search' | 'manual_action';

interface Pattern {
  id: string;
  type: EventType;
  trigger: string;
  frequency: number;
  firstSeen: string;
  lastSeen: string;
  metadata: Record<string, unknown>;
}

interface WorkflowCache {
  version: string;
  patterns: Pattern[];
  lastPruned: string;
}

function getDefaultCache(): WorkflowCache {
  return {
    version: '1.0',
    patterns: [],
    lastPruned: new Date().toISOString(),
  };
}

export async function loadCache(workspaceRoot: string): Promise<WorkflowCache> {
  const cachePath = join(workspaceRoot, CACHE_FILE);
  try {
    const content = await readFile(cachePath, 'utf-8');
    return JSON.parse(content) as WorkflowCache;
  } catch {
    return getDefaultCache();
  }
}

export async function saveCache(workspaceRoot: string, cache: WorkflowCache): Promise<void> {
  // Prune old patterns
  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  cache.patterns = cache.patterns.filter(p => new Date(p.lastSeen).getTime() > cutoff);
  cache.lastPruned = new Date().toISOString();

  const cachePath = join(workspaceRoot, CACHE_FILE);
  await writeFile(cachePath, JSON.stringify(cache, null, 2) + '\n', 'utf-8');
}

export async function logEvent(
  workspaceRoot: string,
  type: EventType,
  trigger: string,
  metadata: Record<string, unknown> = {}
): Promise<Pattern> {
  const cache = await loadCache(workspaceRoot);
  const now = new Date().toISOString();

  // Find existing pattern with same type + trigger
  const existing = cache.patterns.find(p => p.type === type && p.trigger === trigger);

  if (existing) {
    existing.frequency++;
    existing.lastSeen = now;
    existing.metadata = { ...existing.metadata, ...metadata };
    await saveCache(workspaceRoot, cache);
    return existing;
  }

  // Create new pattern
  const pattern: Pattern = {
    id: randomUUID().slice(0, 8),
    type,
    trigger,
    frequency: 1,
    firstSeen: now,
    lastSeen: now,
    metadata,
  };

  cache.patterns.push(pattern);
  await saveCache(workspaceRoot, cache);
  return pattern;
}

export async function getPatterns(
  workspaceRoot: string,
  type?: EventType,
  minFrequency = 1
): Promise<Pattern[]> {
  const cache = await loadCache(workspaceRoot);

  return cache.patterns
    .filter(p => (!type || p.type === type) && p.frequency >= minFrequency)
    .sort((a, b) => b.frequency - a.frequency);
}

export async function clearCache(workspaceRoot: string): Promise<void> {
  await saveCache(workspaceRoot, getDefaultCache());
}

export function registerObserverTools(server: McpServer): void {
  // observer_log - record an event
  server.registerTool(
    'observer_log',
    {
      description: 'Log a workflow event for pattern tracking',
      inputSchema: {
        type: z.enum(['tool_invocation', 'error', 'search', 'manual_action'])
          .describe('Type of event'),
        trigger: z.string().describe('Description of what triggered this event'),
        metadata: z.record(z.unknown()).optional().describe('Additional context'),
        workspaceRoot: z.string().optional().describe('Workspace root (defaults to cwd)'),
      },
    },
    async ({ type, trigger, metadata, workspaceRoot }) => {
      const root = workspaceRoot || process.cwd();
      const pattern = await logEvent(root, type as EventType, trigger, metadata || {});

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            logged: true,
            patternId: pattern.id,
            frequency: pattern.frequency,
            isNew: pattern.frequency === 1,
          }, null, 2),
        }],
      };
    }
  );

  // observer_get_patterns - retrieve patterns
  server.registerTool(
    'observer_get_patterns',
    {
      description: 'Get tracked workflow patterns',
      inputSchema: {
        type: z.enum(['tool_invocation', 'error', 'search', 'manual_action'])
          .optional()
          .describe('Filter by event type'),
        minFrequency: z.number().optional().describe('Minimum occurrence count'),
        workspaceRoot: z.string().optional().describe('Workspace root (defaults to cwd)'),
      },
    },
    async ({ type, minFrequency, workspaceRoot }) => {
      const root = workspaceRoot || process.cwd();
      const patterns = await getPatterns(root, type as EventType | undefined, minFrequency);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            count: patterns.length,
            patterns: patterns.map(p => ({
              id: p.id,
              type: p.type,
              trigger: p.trigger,
              frequency: p.frequency,
              lastSeen: p.lastSeen,
            })),
          }, null, 2),
        }],
      };
    }
  );

  // observer_clear - reset cache
  server.registerTool(
    'observer_clear',
    {
      description: 'Clear all tracked patterns (reset workflow cache)',
      inputSchema: {
        workspaceRoot: z.string().optional().describe('Workspace root (defaults to cwd)'),
      },
    },
    async ({ workspaceRoot }) => {
      const root = workspaceRoot || process.cwd();
      await clearCache(root);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ cleared: true }, null, 2),
        }],
      };
    }
  );
}
