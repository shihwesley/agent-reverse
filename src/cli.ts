#!/usr/bin/env node
// AgentReverse CLI
// Usage: npx agent-reverse <command> [args]

import { fetchRepo, cleanupClone } from './tools/fetch.js';
import { analyzeRepo } from './tools/analyze.js';
import { installCapability } from './tools/install.js';
import { manifestSync } from './tools/sync.js';
import { manifestCheckUpdates } from './tools/sync.js';
import { loadManifest, listCapabilities } from './tools/manifest.js';
import { createBackup, restoreBackup } from './tools/backup.js';
import { mkdir, writeFile, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { TargetAgent } from './types.js';

const HELP = `
AgentReverse CLI - Extract capabilities from GitHub repos

Usage: agent-reverse <command> [options]

Commands:
  setup              Install AgentReverse skills to current workspace
  analyze <url>      Analyze a GitHub repo for capabilities
  install <id>       Install a capability (after analyze)
  sync               Reinstall all capabilities from manifest
  check-updates      Check for updates to installed capabilities
  audit              Check for bloat and duplicates
  list               List installed capabilities
  backup             Create backup of all configs and skills
  restore <source>   Restore from backup file, gist, or URL

Options:
  --json             Output JSON instead of human-readable
  --workspace <dir>  Workspace root (default: cwd)
  --target <agent>   Target agent: claude-code, cursor, antigravity
  --output <file>    Output path for backup
  --gist             Upload backup to GitHub Gist
  --gist-public      Make gist public (default: private)
  --repo <owner/repo> Push backup to GitHub repo
  --merge            Merge with existing (for restore)
  --force            Overwrite existing files
  --dry-run          Preview restore without writing
  --help, -h         Show this help

Examples:
  agent-reverse setup                               # Install skills to .claude/commands/
  agent-reverse analyze https://github.com/user/repo
  agent-reverse install my-skill --target cursor
  agent-reverse sync --workspace /path/to/project
  agent-reverse backup --gist                       # Backup to private gist
  agent-reverse restore backup.json --target cursor # Cross-agent restore
`;

interface CliOptions {
  json: boolean;
  workspace: string;
  target?: TargetAgent;
  output?: string;
  gist?: boolean;
  gistPublic?: boolean;
  repo?: string;
  merge?: boolean;
  force?: boolean;
  dryRun?: boolean;
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
    } else if (arg === '--output' && args[i + 1]) {
      options.output = args[++i];
    } else if (arg === '--gist') {
      options.gist = true;
    } else if (arg === '--gist-public') {
      options.gistPublic = true;
      options.gist = true;
    } else if (arg === '--repo' && args[i + 1]) {
      options.repo = args[++i];
    } else if (arg === '--merge') {
      options.merge = true;
    } else if (arg === '--force') {
      options.force = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
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

async function cmdSetup(options: CliOptions): Promise<void> {
  const commandsDir = join(options.workspace, '.claude', 'commands');
  await mkdir(commandsDir, { recursive: true });

  // Get path to bundled skills (relative to dist/cli.js)
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const skillsDir = join(__dirname, '..', 'skills');

  const skills = [
    { src: 'agent-reverse.md', dest: 'agent-reverse.md' },
    { src: 'agent-reverse-update/SKILL.md', dest: 'agent-reverse-update.md' },
  ];

  let installed = 0;
  for (const skill of skills) {
    try {
      const content = await readFile(join(skillsDir, skill.src), 'utf-8');
      await writeFile(join(commandsDir, skill.dest), content, 'utf-8');
      console.log(`  ✓ Installed ${skill.dest}`);
      installed++;
    } catch (err) {
      console.error(`  ✗ Failed to install ${skill.dest}: ${err}`);
    }
  }

  if (options.json) {
    output({ installed, commandsDir });
  } else {
    console.log(`\n${installed} skills installed to ${commandsDir}`);
    console.log(`
Next: Add the MCP server to Claude Code:

  claude mcp add agent-reverse -- npx -y @shihwesley/agent-reverse agent-reverse-server

Then restart Claude Code. You'll have access to:
  - /agent-reverse analyze <url>  - Extract skills from repos
  - /agent-reverse-update         - Check for skill updates
  - 25 MCP tools for surgical extraction
`);
  }
}

async function cmdBackup(options: CliOptions): Promise<void> {
  const result = await createBackup(options.workspace, {
    outputPath: options.output,
    gist: options.gist,
    gistPublic: options.gistPublic,
    repo: options.repo,
  });

  if (options.json) {
    output(result);
  } else {
    if (result.success) {
      console.log(`Backup created: ${result.fileCount} files`);
      if (result.backupPath) console.log(`  File: ${result.backupPath}`);
      if (result.gistUrl) console.log(`  Gist: ${result.gistUrl}`);
      if (result.repoUrl) console.log(`  Repo: ${result.repoUrl}`);
    } else {
      console.error('Backup failed:');
      result.errors.forEach(e => console.error(`  - ${e}`));
    }
  }
}

async function cmdRestore(source: string, options: CliOptions): Promise<void> {
  const result = await restoreBackup(options.workspace, source, {
    targetAgent: options.target,
    merge: options.merge,
    force: options.force,
    dryRun: options.dryRun,
  });

  if (options.json) {
    output(result);
  } else {
    if (options.dryRun) {
      console.log('Dry run - would restore:');
      result.filesRestored.forEach(f => console.log(`  + ${f}`));
      if (result.converted) console.log(`  (cross-agent conversion: ${options.target})`);
    } else if (result.success) {
      console.log(`Restored ${result.filesRestored.length} files`);
      if (result.filesSkipped.length > 0) {
        console.log(`Skipped ${result.filesSkipped.length} existing files (use --force to overwrite)`);
      }
      if (result.converted) {
        console.log(`Converted from different agent to ${options.target}`);
      }
    } else {
      console.error('Restore failed:');
      result.errors.forEach(e => console.error(`  - ${e}`));
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
      case 'setup':
        await cmdSetup(options);
        break;

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

      case 'backup':
        await cmdBackup(options);
        break;

      case 'restore':
        if (!positional[0]) {
          console.error('Error: Backup source required');
          process.exit(1);
        }
        await cmdRestore(positional[0], options);
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
