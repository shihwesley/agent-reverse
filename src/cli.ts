#!/usr/bin/env node
// AgentReverse CLI
// Usage: npx agent-reverse <command> [args]

import { fetchRepo, cleanupClone } from './tools/fetch.js';
import { analyzeRepo } from './tools/analyze.js';
import { installCapability } from './tools/install.js';
import { manifestSync } from './tools/sync.js';
import { manifestCheckUpdates } from './tools/sync.js';
import { loadManifest, listCapabilities } from './tools/manifest.js';
import type { TargetAgent } from './types.js';

const HELP = `
AgentReverse CLI - Extract capabilities from GitHub repos

Usage: agent-reverse <command> [options]

Commands:
  analyze <url>      Analyze a GitHub repo for capabilities
  install <id>       Install a capability (after analyze)
  sync               Reinstall all capabilities from manifest
  check-updates      Check for updates to installed capabilities
  audit              Check for bloat and duplicates
  list               List installed capabilities

Options:
  --json             Output JSON instead of human-readable
  --workspace <dir>  Workspace root (default: cwd)
  --target <agent>   Target agent: claude-code, cursor, antigravity
  --help, -h         Show this help

Examples:
  agent-reverse analyze https://github.com/user/repo
  agent-reverse install my-skill --target cursor
  agent-reverse sync --workspace /path/to/project
`;

interface CliOptions {
  json: boolean;
  workspace: string;
  target?: TargetAgent;
}

function parseArgs(args: string[]): { command: string; positional: string[]; options: CliOptions } {
  const options: CliOptions = {
    json: false,
    workspace: process.cwd(),
  };
  const positional: string[] = [];
  let command = '';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--json') {
      options.json = true;
    } else if (arg === '--workspace' && args[i + 1]) {
      options.workspace = args[++i];
    } else if (arg === '--target' && args[i + 1]) {
      options.target = args[++i] as TargetAgent;
    } else if (arg === '--help' || arg === '-h') {
      console.log(HELP);
      process.exit(0);
    } else if (!arg.startsWith('-')) {
      if (!command) {
        command = arg;
      } else {
        positional.push(arg);
      }
    }
  }

  return { command, positional, options };
}

function output(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

// Store last analyzed repo for install command
let lastAnalysis: { url: string; path: string; commit: string } | null = null;

async function cmdAnalyze(url: string, options: CliOptions): Promise<void> {
  console.error(`Fetching ${url}...`);

  const fetchResult = await fetchRepo(url, undefined, options.workspace);
  console.error(`Cloned at ${fetchResult.commit.slice(0, 7)}`);

  console.error('Analyzing...');
  const analysis = await analyzeRepo(fetchResult.path);

  // Store for install command
  lastAnalysis = { url, path: fetchResult.path, commit: fetchResult.commit };

  if (options.json) {
    output(analysis);
  } else {
    console.log(`\nFound ${analysis.skills.length} skills, ${analysis.tools.length} tools\n`);

    if (analysis.skills.length > 0) {
      console.log('Skills:');
      for (const skill of analysis.skills) {
        console.log(`  - ${skill.name}: ${skill.description}`);
        console.log(`    Path: ${skill.filePath}`);
      }
    }

    if (analysis.tools.length > 0) {
      console.log('\nTools:');
      for (const tool of analysis.tools) {
        console.log(`  - ${tool.name}: ${tool.description}`);
      }
    }

    console.log(`\nUse 'agent-reverse install <name>' to install a capability`);
  }
}

async function cmdInstall(id: string, options: CliOptions): Promise<void> {
  if (!lastAnalysis) {
    console.error('Error: Run "analyze <url>" first, or provide --url');
    process.exit(1);
  }

  const target = options.target ?? detectTargetAgent(options.workspace);
  console.error(`Installing ${id} for ${target}...`);

  // Find the skill path from last analysis
  const analysis = await analyzeRepo(lastAnalysis.path);
  const skill = analysis.skills.find(s => s.name === id || s.filePath.includes(id));

  if (!skill) {
    console.error(`Error: Capability '${id}' not found in analyzed repo`);
    process.exit(1);
  }

  const result = await installCapability({
    skillPath: skill.filePath,
    sourceRepoPath: lastAnalysis.path,
    sourceUrl: lastAnalysis.url,
    commit: lastAnalysis.commit,
    capabilityId: id,
    targetAgent: target,
    workspaceRoot: options.workspace,
  });

  if (options.json) {
    output(result);
  } else {
    if (result.success) {
      console.log(`\nInstalled ${id}`);
      console.log(`Files: ${result.filesWritten.join(', ')}`);
    } else {
      console.error(`\nFailed to install ${id}`);
      console.error(`Errors: ${result.errors.join(', ')}`);
      process.exit(1);
    }
  }
}

async function cmdSync(options: CliOptions): Promise<void> {
  console.error('Syncing capabilities from manifest...');

  const result = await manifestSync(options.workspace, options.target);

  if (options.json) {
    output(result);
  } else {
    console.log(`\nSync complete`);
    console.log(`  Installed: ${result.installed.length}`);
    console.log(`  Failed: ${result.failed.length}`);
    console.log(`  Skipped: ${result.skipped.length}`);

    if (result.failed.length > 0) {
      console.log('\nFailures:');
      for (const f of result.failed) {
        console.log(`  - ${f.id}: ${f.error}`);
      }
    }
  }
}

async function cmdCheckUpdates(options: CliOptions): Promise<void> {
  console.error('Checking for updates...');

  const result = await manifestCheckUpdates(options.workspace);

  if (options.json) {
    output(result);
  } else {
    if (result.outdated.length === 0) {
      console.log('\nAll capabilities up to date');
    } else {
      console.log(`\n${result.outdated.length} outdated:`);
      for (const u of result.outdated) {
        console.log(`  - ${u.id}: ${u.pinnedCommit.slice(0, 7)} → ${u.latestCommit.slice(0, 7)}`);
      }
    }

    if (result.failed.length > 0) {
      console.log('\nFailed to check:');
      for (const f of result.failed) {
        console.log(`  - ${f.id}: ${f.error}`);
      }
    }
  }
}

async function cmdAudit(options: CliOptions): Promise<void> {
  console.error('Auditing capabilities...');

  const capabilities = await listCapabilities(options.workspace);

  if (options.json) {
    output({ capabilities, untracked: [], duplicates: [] });
  } else {
    console.log(`\n${capabilities.length} capabilities in manifest`);

    for (const cap of capabilities) {
      console.log(`  - ${cap.id} (${cap.commit.slice(0, 7)}) - ${cap.files.length} files`);
    }

    console.log('\nNote: Full audit with duplicate detection coming in Phase 4');
  }
}

async function cmdList(options: CliOptions): Promise<void> {
  const capabilities = await listCapabilities(options.workspace);

  if (options.json) {
    output(capabilities);
  } else {
    if (capabilities.length === 0) {
      console.log('No capabilities installed');
    } else {
      console.log(`${capabilities.length} capabilities:\n`);
      for (const cap of capabilities) {
        console.log(`  ${cap.id}`);
        console.log(`    Source: ${cap.source}`);
        console.log(`    Commit: ${cap.commit.slice(0, 7)}`);
        console.log(`    Status: ${cap.status}`);
      }
    }
  }
}

function detectTargetAgent(workspace: string): TargetAgent {
  const fs = require('fs');
  const path = require('path');

  if (fs.existsSync(path.join(workspace, '.claude'))) return 'claude-code';
  if (fs.existsSync(path.join(workspace, '.cursor'))) return 'cursor';
  if (fs.existsSync(path.join(workspace, '.agent'))) return 'antigravity';

  return 'claude-code'; // Default
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(HELP);
    process.exit(0);
  }

  const { command, positional, options } = parseArgs(args);

  try {
    switch (command) {
      case 'analyze':
        if (!positional[0]) {
          console.error('Error: URL required');
          process.exit(1);
        }
        await cmdAnalyze(positional[0], options);
        break;

      case 'install':
        if (!positional[0]) {
          console.error('Error: Capability ID required');
          process.exit(1);
        }
        await cmdInstall(positional[0], options);
        break;

      case 'sync':
        await cmdSync(options);
        break;

      case 'check-updates':
        await cmdCheckUpdates(options);
        break;

      case 'audit':
        await cmdAudit(options);
        break;

      case 'list':
        await cmdList(options);
        break;

      default:
        console.error(`Unknown command: ${command}`);
        console.log(HELP);
        process.exit(1);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}

main();
