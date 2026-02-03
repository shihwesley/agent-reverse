// repo_analyze tool - Phase 1
// Parse repo for skills, tools, plugins

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readFile, readdir, stat } from 'fs/promises';
import { join } from 'path';
import { parseSkillFile, isSkillPath } from '../parsers/skill.js';
import { parseReadme } from '../parsers/readme.js';
import { scanDirectoryForMcpTools, toAnalyzeFormat } from '../parsers/mcp.js';
import type { RepoAnalysis, ParsedSkill, ParsedTool } from '../types.js';

async function findFiles(
  dir: string,
  predicate: (path: string) => boolean,
  base = ''
): Promise<string[]> {
  const results: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const relativePath = base ? `${base}/${entry.name}` : entry.name;
    const fullPath = join(dir, entry.name);

    // Skip hidden dirs and node_modules
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

    if (entry.isDirectory()) {
      results.push(...await findFiles(fullPath, predicate, relativePath));
    } else if (predicate(relativePath)) {
      results.push(relativePath);
    }
  }
  return results;
}

async function readFileContent(basePath: string, relativePath: string): Promise<string | null> {
  try {
    return await readFile(join(basePath, relativePath), 'utf-8');
  } catch {
    return null;
  }
}

export async function analyzeRepo(repoPath: string): Promise<RepoAnalysis> {
  const skills: ParsedSkill[] = [];
  const tools: ParsedTool[] = [];
  const plugins: string[] = [];
  let readme: string | undefined;
  const dependencies: string[] = [];

  // Find and parse README
  const readmePaths = ['README.md', 'readme.md', 'Readme.md'];
  for (const readmePath of readmePaths) {
    const content = await readFileContent(repoPath, readmePath);
    if (content) {
      readme = content;
      const parsed = parseReadme(content);
      dependencies.push(...parsed.dependencies);
      break;
    }
  }

  // Find skill files
  const mdFiles = await findFiles(repoPath, isSkillPath);

  for (const filePath of mdFiles) {
    const content = await readFileContent(repoPath, filePath);
    if (!content) continue;

    const skill = parseSkillFile(content, filePath);
    if (skill) {
      skills.push(skill);
    }
  }

  // Check for package.json to identify plugins/dependencies
  const pkgContent = await readFileContent(repoPath, 'package.json');
  if (pkgContent) {
    try {
      const pkg = JSON.parse(pkgContent);

      // Check if it's an MCP server
      if (pkg.dependencies?.['@modelcontextprotocol/sdk'] ||
          pkg.devDependencies?.['@modelcontextprotocol/sdk']) {
        plugins.push('mcp-server');
      }

      // Extract deps
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.peerDependencies,
      };
      dependencies.push(...Object.keys(allDeps || {}));
    } catch {
      // Invalid JSON
    }
  }

  // Check for .mcp.json (MCP config)
  const mcpConfig = await readFileContent(repoPath, '.mcp.json');
  if (mcpConfig) {
    plugins.push('mcp-configured');
  }

  // Extract MCP tools from server files
  if (plugins.includes('mcp-server')) {
    const allFiles = await findFiles(repoPath, (p) =>
      p.endsWith('.ts') || p.endsWith('.js')
    );
    const extractedTools = await scanDirectoryForMcpTools(repoPath, allFiles);
    tools.push(...toAnalyzeFormat(extractedTools));
  }

  // Dedupe dependencies
  const uniqueDeps = [...new Set(dependencies)];

  return {
    skills,
    tools,
    plugins,
    readme,
    dependencies: uniqueDeps,
  };
}

export function registerAnalyzeTool(server: McpServer): void {
  server.registerTool(
    'repo_analyze',
    {
      description: 'Analyze a cloned repo for skills, tools, plugins, and dependencies',
      inputSchema: {
        path: z.string().describe('Path to the cloned repo (from repo_fetch)'),
      },
    },
    async ({ path }) => {
      try {
        // Verify path exists
        const stats = await stat(path);
        if (!stats.isDirectory()) {
          return {
            content: [{ type: 'text' as const, text: 'Error: Path is not a directory' }],
            isError: true,
          };
        }

        const analysis = await analyzeRepo(path);

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                skillCount: analysis.skills.length,
                skills: analysis.skills.map(s => ({
                  name: s.name,
                  description: s.description,
                  path: s.filePath,
                  userInvocable: s.frontmatter['user-invocable'] === true,
                })),
                toolCount: analysis.tools.length,
                tools: analysis.tools,
                plugins: analysis.plugins,
                dependencyCount: analysis.dependencies.length,
                dependencies: analysis.dependencies.slice(0, 20),
                hasReadme: !!analysis.readme,
              }, null, 2),
            },
          ],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    }
  );
}
