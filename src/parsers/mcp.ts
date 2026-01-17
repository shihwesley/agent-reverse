// MCP tool extractor - Phase 4
// Parse server.tool() and server.registerTool() calls from TypeScript/JavaScript
// Uses tree-sitter for AST parsing with regex fallback

import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';
import type { ExtractedMcpTool, ParsedTool } from '../types.js';

const parser = new Parser();

// Tool call patterns
const TOOL_METHODS = ['tool', 'registerTool', 'setRequestHandler'];

// Regex fallback pattern for simple extraction
const REGEX_PATTERN = /server\.(?:register)?[Tt]ool\s*\(\s*["'`]([^"'`]+)["'`]/g;

/**
 * Parse MCP tools from a TypeScript/JavaScript file using tree-sitter
 */
export async function parseMcpToolsFromFile(filePath: string): Promise<ExtractedMcpTool[]> {
  const content = await readFile(filePath, 'utf-8');
  return parseMcpTools(content, filePath);
}

/**
 * Parse MCP tools from content string
 */
export function parseMcpTools(content: string, filePath: string): ExtractedMcpTool[] {
  const ext = extname(filePath).toLowerCase();

  // Set language based on extension
  if (ext === '.ts' || ext === '.tsx') {
    parser.setLanguage(TypeScript.typescript);
  } else if (ext === '.js' || ext === '.jsx' || ext === '.mjs') {
    // tree-sitter-typescript can parse JS too
    parser.setLanguage(TypeScript.typescript);
  } else {
    // Unsupported file type, try regex fallback
    return extractToolsWithRegex(content, filePath);
  }

  try {
    const tree = parser.parse(content);
    const tools = extractToolsFromAST(tree.rootNode, content, filePath);

    // If AST extraction found nothing, try regex fallback
    if (tools.length === 0) {
      return extractToolsWithRegex(content, filePath);
    }

    return tools;
  } catch (error) {
    // AST parsing failed, use regex fallback
    return extractToolsWithRegex(content, filePath);
  }
}

/**
 * Extract tools from AST using tree-sitter
 */
function extractToolsFromAST(
  node: Parser.SyntaxNode,
  content: string,
  filePath: string
): ExtractedMcpTool[] {
  const tools: ExtractedMcpTool[] = [];

  function visit(node: Parser.SyntaxNode) {
    // Look for call expressions
    if (node.type === 'call_expression') {
      const tool = tryExtractToolCall(node, content, filePath);
      if (tool) {
        tools.push(tool);
      }
    }

    // Recurse into children
    for (const child of node.children) {
      visit(child);
    }
  }

  visit(node);
  return tools;
}

/**
 * Try to extract a tool definition from a call expression node
 */
function tryExtractToolCall(
  node: Parser.SyntaxNode,
  content: string,
  filePath: string
): ExtractedMcpTool | null {
  // Get the function being called (e.g., server.tool or server.registerTool)
  const functionNode = node.childForFieldName('function');
  if (!functionNode) return null;

  // Check if it's a member expression (object.method)
  if (functionNode.type !== 'member_expression') return null;

  const propertyNode = functionNode.childForFieldName('property');
  if (!propertyNode) return null;

  const methodName = propertyNode.text;
  if (!TOOL_METHODS.includes(methodName)) return null;

  // Get arguments
  const argsNode = node.childForFieldName('arguments');
  if (!argsNode) return null;

  const args = argsNode.namedChildren;
  if (args.length < 1) return null;

  // First arg is tool name (string)
  const nameArg = args[0];
  const toolName = extractStringValue(nameArg);
  if (!toolName) return null;

  // Second arg is config object with description and inputSchema
  let description = '';
  let inputSchema: Record<string, unknown> = {};

  if (args.length >= 2) {
    const configArg = args[1];
    if (configArg.type === 'object') {
      const extracted = extractToolConfig(configArg, content);
      description = extracted.description;
      inputSchema = extracted.inputSchema;
    }
  }

  return {
    name: toolName,
    description,
    inputSchema,
    filePath,
    lineNumber: node.startPosition.row + 1,
  };
}

/**
 * Extract string value from an AST node
 */
function extractStringValue(node: Parser.SyntaxNode): string | null {
  if (node.type === 'string') {
    // Remove quotes
    const text = node.text;
    return text.slice(1, -1);
  }
  if (node.type === 'template_string') {
    // Simple template string without interpolations
    const text = node.text;
    return text.slice(1, -1);
  }
  return null;
}

/**
 * Extract tool config (description, inputSchema) from object literal
 */
function extractToolConfig(
  node: Parser.SyntaxNode,
  content: string
): { description: string; inputSchema: Record<string, unknown> } {
  let description = '';
  const inputSchema: Record<string, unknown> = {};

  for (const prop of node.namedChildren) {
    if (prop.type !== 'pair') continue;

    const keyNode = prop.childForFieldName('key');
    const valueNode = prop.childForFieldName('value');
    if (!keyNode || !valueNode) continue;

    const key = keyNode.text;

    if (key === 'description') {
      description = extractStringValue(valueNode) || '';
    } else if (key === 'inputSchema') {
      // Extract schema keys
      if (valueNode.type === 'object') {
        for (const schemaProp of valueNode.namedChildren) {
          if (schemaProp.type !== 'pair') continue;
          const schemaKey = schemaProp.childForFieldName('key');
          if (schemaKey) {
            inputSchema[schemaKey.text] = {
              extracted: true,
              sourceText: schemaProp.childForFieldName('value')?.text?.slice(0, 100),
            };
          }
        }
      }
    }
  }

  return { description, inputSchema };
}

/**
 * Regex fallback for extracting tool names
 */
function extractToolsWithRegex(content: string, filePath: string): ExtractedMcpTool[] {
  const tools: ExtractedMcpTool[] = [];
  const lines = content.split('\n');

  let match;
  while ((match = REGEX_PATTERN.exec(content)) !== null) {
    const toolName = match[1];
    const position = match.index;

    // Calculate line number
    let lineNumber = 1;
    let charCount = 0;
    for (const line of lines) {
      charCount += line.length + 1; // +1 for newline
      if (charCount > position) break;
      lineNumber++;
    }

    // Try to extract description from nearby context
    const description = extractDescriptionFromContext(content, position);

    tools.push({
      name: toolName,
      description,
      inputSchema: {},
      filePath,
      lineNumber,
    });
  }

  return tools;
}

/**
 * Try to extract description from context around a tool registration
 */
function extractDescriptionFromContext(content: string, position: number): string {
  // Look for description: '...' or description: "..." nearby
  const searchRange = content.slice(position, position + 500);
  const descMatch = searchRange.match(/description:\s*["'`]([^"'`]+)["'`]/);
  return descMatch ? descMatch[1] : '';
}

/**
 * Scan a directory for MCP server files and extract tools
 */
export async function scanDirectoryForMcpTools(
  dirPath: string,
  files: string[]
): Promise<ExtractedMcpTool[]> {
  const tools: ExtractedMcpTool[] = [];

  const serverPatterns = [
    /server\.ts$/,
    /server\.js$/,
    /index\.ts$/,
    /index\.js$/,
    /mcp.*\.ts$/,
    /mcp.*\.js$/,
  ];

  for (const file of files) {
    const isServerFile = serverPatterns.some(p => p.test(file));
    if (!isServerFile) continue;

    try {
      const fullPath = join(dirPath, file);
      const fileTools = await parseMcpToolsFromFile(fullPath);
      tools.push(...fileTools);
    } catch {
      // Skip files that can't be read
    }
  }

  return tools;
}

/**
 * Convert ExtractedMcpTool to ParsedTool for analyze output
 */
export function toAnalyzeFormat(tools: ExtractedMcpTool[]): ParsedTool[] {
  return tools.map(t => ({
    name: t.name,
    description: t.description,
    filePath: t.filePath,
    inputSchema: Object.keys(t.inputSchema).length > 0 ? t.inputSchema : undefined,
  }));
}
