// web_interpret tool - Phase 5
// Fetch web articles, extract concepts, synthesize skills

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import * as cheerio from 'cheerio';
import { addCapability } from './manifest.js';
import type {
  WebArticle,
  ExtractedConcept,
  SynthesizedSkill,
  WebInterpretResult,
  Capability,
} from '../types.js';

// Category keywords for classification
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'search': ['search', 'query', 'retrieval', 'find', 'lookup'],
  'reasoning': ['reason', 'think', 'logic', 'inference', 'chain-of-thought'],
  'code': ['code', 'programming', 'implementation', 'algorithm', 'function'],
  'data': ['data', 'parse', 'transform', 'extract', 'process'],
  'workflow': ['workflow', 'automation', 'pipeline', 'process', 'step'],
  'testing': ['test', 'validate', 'verify', 'check', 'assert'],
  'documentation': ['document', 'readme', 'comment', 'explain', 'describe'],
};

/**
 * Fetch and parse a web article
 */
export async function fetchArticle(url: string): Promise<WebArticle> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Remove scripts, styles, nav, footer
  $('script, style, nav, footer, header, aside, .sidebar, .comments').remove();

  // Extract title
  const title = $('h1').first().text().trim() ||
    $('title').text().trim() ||
    'Untitled Article';

  // Extract headings
  const headings: string[] = [];
  $('h1, h2, h3').each((_, el) => {
    const text = $(el).text().trim();
    if (text) headings.push(text);
  });

  // Extract code blocks
  const codeBlocks: string[] = [];
  $('pre, code').each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length > 20) {
      codeBlocks.push(text.slice(0, 500)); // Limit size
    }
  });

  // Extract main content
  const contentSelectors = ['article', 'main', '.content', '.post', '.entry', 'body'];
  let content = '';

  for (const selector of contentSelectors) {
    const el = $(selector).first();
    if (el.length) {
      content = el.text().trim();
      if (content.length > 200) break;
    }
  }

  // Clean up content - remove excessive whitespace
  content = content
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim()
    .slice(0, 10000); // Limit size

  return {
    url,
    title,
    content,
    headings,
    codeBlocks,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Extract core concept from article
 */
export function extractConcept(article: WebArticle): ExtractedConcept {
  const text = `${article.title} ${article.headings.join(' ')} ${article.content}`.toLowerCase();

  // Determine category
  let category = 'general';
  let maxScore = 0;

  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.filter(kw => text.includes(kw)).length;
    if (score > maxScore) {
      maxScore = score;
      category = cat;
    }
  }

  // Generate suggested name from title
  const suggestedName = article.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

  // Extract key points from headings
  const keyPoints = article.headings
    .filter(h => h.length > 5 && h.length < 100)
    .slice(0, 5);

  // Extract core idea from first paragraph-like content
  const sentences = article.content.split(/[.!?]+/).filter(s => s.trim().length > 20);
  const coreIdea = sentences.slice(0, 3).join('. ').trim() + '.';

  return {
    coreIdea: coreIdea.slice(0, 500),
    keyPoints,
    suggestedName: suggestedName || 'web-skill',
    category,
    relatedTools: detectRelatedTools(text),
  };
}

/**
 * Detect tools that might be related to the concept
 */
function detectRelatedTools(text: string): string[] {
  const tools: string[] = [];

  if (text.includes('search') || text.includes('query')) {
    tools.push('search', 'grep');
  }
  if (text.includes('file') || text.includes('read')) {
    tools.push('read', 'glob');
  }
  if (text.includes('git') || text.includes('commit')) {
    tools.push('git', 'bash');
  }
  if (text.includes('test') || text.includes('assert')) {
    tools.push('test', 'bash');
  }
  if (text.includes('api') || text.includes('fetch')) {
    tools.push('web', 'fetch');
  }

  return [...new Set(tools)];
}

/**
 * Synthesize a skill from extracted concept
 */
export function synthesizeSkill(
  article: WebArticle,
  concept: ExtractedConcept,
  customName?: string
): SynthesizedSkill {
  const name = customName || concept.suggestedName;

  const description = `Skill synthesized from: ${article.title}. ${concept.coreIdea.slice(0, 150)}`;

  // Build skill content
  const lines: string[] = [
    `# ${article.title}`,
    '',
    `> Synthesized from: ${article.url}`,
    '',
    '## Core Concept',
    '',
    concept.coreIdea,
    '',
  ];

  if (concept.keyPoints.length > 0) {
    lines.push('## Key Points', '');
    for (const point of concept.keyPoints) {
      lines.push(`- ${point}`);
    }
    lines.push('');
  }

  if (article.codeBlocks.length > 0) {
    lines.push('## Code Examples', '');
    for (const code of article.codeBlocks.slice(0, 3)) {
      lines.push('```', code.slice(0, 300), '```', '');
    }
  }

  if (concept.relatedTools && concept.relatedTools.length > 0) {
    lines.push('## Related Tools', '');
    lines.push(`Consider using: ${concept.relatedTools.join(', ')}`, '');
  }

  lines.push('## Implementation Notes', '');
  lines.push('Apply this concept by:', '');
  lines.push('1. Understanding the core idea above');
  lines.push('2. Adapting the approach to your specific use case');
  lines.push('3. Using the related tools to implement the pattern');
  lines.push('');

  return {
    name,
    description,
    content: lines.join('\n'),
    sourceUrl: article.url,
    concept,
  };
}

/**
 * Write synthesized skill to disk
 */
async function writeSkill(
  workspaceRoot: string,
  skill: SynthesizedSkill
): Promise<string> {
  const skillPath = `.claude/skills/${skill.name}/SKILL.md`;
  const fullPath = join(workspaceRoot, skillPath);

  // Ensure directory exists
  await mkdir(dirname(fullPath), { recursive: true });

  // Build skill file with frontmatter
  const fileContent = `---
name: ${skill.name}
description: ${skill.description.slice(0, 200)}
source: ${skill.sourceUrl}
category: ${skill.concept.category}
synthesized: true
---

${skill.content}
`;

  await writeFile(fullPath, fileContent, 'utf-8');
  return skillPath;
}

/**
 * Full web interpret pipeline
 */
export async function interpretWeb(
  url: string,
  workspaceRoot: string,
  options: {
    skillName?: string;
    saveToManifest?: boolean;
  } = {}
): Promise<WebInterpretResult> {
  try {
    // 1. Fetch article
    const article = await fetchArticle(url);

    // 2. Extract concept
    const concept = extractConcept(article);

    // 3. Synthesize skill
    const skill = synthesizeSkill(article, concept, options.skillName);

    // 4. Write to disk
    const skillPath = await writeSkill(workspaceRoot, skill);

    // 5. Add to manifest if requested
    if (options.saveToManifest !== false) {
      const capability: Capability = {
        id: skill.name,
        source: url,
        commit: 'web-synthesis',
        files: [skillPath],
        extractedFrom: url,
        dependencies: [],
        status: 'installed',
        installedAt: new Date().toISOString(),
      };
      await addCapability(workspaceRoot, capability);
    }

    return {
      success: true,
      article,
      concept,
      skill,
      skillPath,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Register web synthesis tools
 */
export function registerWebTools(server: McpServer): void {
  server.registerTool(
    'web_interpret',
    {
      description: 'Fetch a web article, extract its core concept, and synthesize a skill from it',
      inputSchema: {
        url: z.string().url().describe('URL of article to interpret'),
        skillName: z.string().optional().describe('Custom name for synthesized skill'),
        saveToManifest: z.boolean().optional().default(true).describe('Save to agent-reverse manifest'),
        workspaceRoot: z.string().optional().describe('Workspace root (defaults to cwd)'),
      },
    },
    async ({ url, skillName, saveToManifest, workspaceRoot }) => {
      try {
        const root = workspaceRoot || process.cwd();
        const result = await interpretWeb(url, root, { skillName, saveToManifest });

        if (!result.success) {
          return {
            content: [{ type: 'text' as const, text: `Error: ${result.error}` }],
            isError: true,
          };
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              articleTitle: result.article?.title,
              concept: {
                coreIdea: result.concept?.coreIdea?.slice(0, 200),
                category: result.concept?.category,
                keyPoints: result.concept?.keyPoints,
              },
              skill: {
                name: result.skill?.name,
                description: result.skill?.description?.slice(0, 150),
              },
              skillPath: result.skillPath,
            }, null, 2),
          }],
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

  server.registerTool(
    'web_fetch',
    {
      description: 'Fetch and parse a web article without synthesizing a skill',
      inputSchema: {
        url: z.string().url().describe('URL of article to fetch'),
      },
    },
    async ({ url }) => {
      try {
        const article = await fetchArticle(url);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              title: article.title,
              headingCount: article.headings.length,
              headings: article.headings.slice(0, 10),
              codeBlockCount: article.codeBlocks.length,
              contentPreview: article.content.slice(0, 500),
              fetchedAt: article.fetchedAt,
            }, null, 2),
          }],
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
