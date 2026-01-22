// suggester tools - Phase 3
// Proactive suggestions based on workflow patterns

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const CACHE_FILE = 'workflow-cache.json';
const USER_REPOS_FILE = 'known-repos.json';
const MIN_FREQUENCY = 3;

// Types
export interface Pattern {
  id: string;
  type: string;
  trigger: string;
  frequency: number;
  lastSeen: string;
}

export interface WorkflowCache {
  version: string;
  patterns: Pattern[];
}

export interface KnownRepo {
  url: string;
  capabilities: string[];
  keywords: string[];
}

interface ReposRegistry {
  version: string;
  repos: KnownRepo[];
}

export interface Suggestion {
  type: 'friction' | 'overlap' | 'keyword_match';
  message: string;
  repo: string;
  capability: string;
  confidence: 'high' | 'medium' | 'low';
  patternId?: string;
}

// Load workflow cache (from observer)
export async function loadCache(workspaceRoot: string): Promise<WorkflowCache> {
  try {
    const content = await readFile(join(workspaceRoot, CACHE_FILE), 'utf-8');
    return JSON.parse(content);
  } catch {
    return { version: '1.0', patterns: [] };
  }
}

// Load default repos from bundled file
async function loadDefaultRepos(): Promise<KnownRepo[]> {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const defaultPath = join(__dirname, '..', 'data', 'default-repos.json');
    const content = await readFile(defaultPath, 'utf-8');
    const registry = JSON.parse(content) as ReposRegistry;
    return registry.repos;
  } catch {
    return [];
  }
}

// Load user repos
export async function loadUserRepos(workspaceRoot: string): Promise<KnownRepo[]> {
  try {
    const content = await readFile(join(workspaceRoot, USER_REPOS_FILE), 'utf-8');
    const registry = JSON.parse(content) as ReposRegistry;
    return registry.repos;
  } catch {
    return [];
  }
}

// Save user repos
export async function saveUserRepos(workspaceRoot: string, repos: KnownRepo[]): Promise<void> {
  const registry: ReposRegistry = { version: '1.0', repos };
  await writeFile(
    join(workspaceRoot, USER_REPOS_FILE),
    JSON.stringify(registry, null, 2) + '\n',
    'utf-8'
  );
}

// Get all known repos (defaults + user)
export async function getAllRepos(workspaceRoot: string): Promise<KnownRepo[]> {
  const defaults = await loadDefaultRepos();
  const user = await loadUserRepos(workspaceRoot);

  // User repos override defaults with same URL
  const userUrls = new Set(user.map(r => r.url));
  const filtered = defaults.filter(r => !userUrls.has(r.url));

  return [...filtered, ...user];
}

// Generate suggestions from patterns
export async function generateSuggestions(workspaceRoot: string): Promise<Suggestion[]> {
  const cache = await loadCache(workspaceRoot);
  const repos = await getAllRepos(workspaceRoot);
  const suggestions: Suggestion[] = [];

  // Filter patterns with sufficient frequency
  const significantPatterns = cache.patterns.filter(p => p.frequency >= MIN_FREQUENCY);

  for (const pattern of significantPatterns) {
    const triggerLower = pattern.trigger.toLowerCase();

    for (const repo of repos) {
      // Keyword matching
      for (const keyword of repo.keywords) {
        if (triggerLower.includes(keyword.toLowerCase())) {
          const capability = repo.capabilities[0] || 'unknown';
          suggestions.push({
            type: 'keyword_match',
            message: `Noticed "${pattern.trigger}" ${pattern.frequency} times. ${repo.url} has ${capability} that might help.`,
            repo: repo.url,
            capability,
            confidence: pattern.frequency >= 5 ? 'high' : 'medium',
            patternId: pattern.id,
          });
          break; // One suggestion per pattern-repo pair
        }
      }

      // Error/friction detection
      if (pattern.type === 'error') {
        for (const capability of repo.capabilities) {
          if (triggerLower.includes(capability.toLowerCase())) {
            suggestions.push({
              type: 'friction',
              message: `Repeated errors with "${pattern.trigger}". Consider ${capability} from ${repo.url}.`,
              repo: repo.url,
              capability,
              confidence: 'medium',
              patternId: pattern.id,
            });
            break;
          }
        }
      }
    }
  }

  // Deduplicate by repo+capability
  const seen = new Set<string>();
  return suggestions.filter(s => {
    const key = `${s.repo}:${s.capability}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function registerSuggesterTools(server: McpServer): void {
  // suggester_check - get suggestions
  server.registerTool(
    'suggester_check',
    {
      description: 'Get proactive suggestions based on workflow patterns',
      inputSchema: {
        workspaceRoot: z.string().optional().describe('Workspace root (defaults to cwd)'),
      },
    },
    async ({ workspaceRoot }) => {
      const root = workspaceRoot || process.cwd();
      const suggestions = await generateSuggestions(root);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            count: suggestions.length,
            suggestions: suggestions.slice(0, 5), // Top 5
          }, null, 2),
        }],
      };
    }
  );

  // suggester_add_repo - add to watch list
  server.registerTool(
    'suggester_add_repo',
    {
      description: 'Add a repo to the known repos watch list',
      inputSchema: {
        url: z.string().describe('GitHub repo URL'),
        capabilities: z.array(z.string()).describe('Capabilities this repo provides'),
        keywords: z.array(z.string()).describe('Keywords to match against patterns'),
        workspaceRoot: z.string().optional().describe('Workspace root (defaults to cwd)'),
      },
    },
    async ({ url, capabilities, keywords, workspaceRoot }) => {
      const root = workspaceRoot || process.cwd();
      const repos = await loadUserRepos(root);

      // Update or add
      const existing = repos.find(r => r.url === url);
      if (existing) {
        existing.capabilities = capabilities;
        existing.keywords = keywords;
      } else {
        repos.push({ url, capabilities, keywords });
      }

      await saveUserRepos(root, repos);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            added: true,
            url,
            capabilities,
            keywords,
          }, null, 2),
        }],
      };
    }
  );

  // suggester_list_repos - list known repos
  server.registerTool(
    'suggester_list_repos',
    {
      description: 'List all known repos (defaults + user-added)',
      inputSchema: {
        workspaceRoot: z.string().optional().describe('Workspace root (defaults to cwd)'),
      },
    },
    async ({ workspaceRoot }) => {
      const root = workspaceRoot || process.cwd();
      const repos = await getAllRepos(root);

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            count: repos.length,
            repos: repos.map(r => ({
              url: r.url,
              capabilities: r.capabilities,
              keywords: r.keywords,
            })),
          }, null, 2),
        }],
      };
    }
  );
}
