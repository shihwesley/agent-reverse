// Manifest types based on spec.md

export type CapabilityStatus = 'installed' | 'superseded' | 'pending';

export type TargetAgent = 'claude-code' | 'antigravity' | 'cursor' | 'custom';

export type InstallScope = 'project' | 'global';

export interface Capability {
  id: string;
  source: string;          // GitHub URL
  commit: string;          // Pinned commit hash
  files: string[];         // Installed file paths
  dependencies: string[];  // Required capability IDs
  status: CapabilityStatus;
  extractedFrom: string;   // Source file in repo
  installedAt: string;     // ISO timestamp
}

export interface Manifest {
  version: string;
  targetAgent: TargetAgent;
  capabilities: Capability[];
  superseded: Capability[];
}

// Parser output types

export interface ParsedSkill {
  name: string;
  description: string;
  filePath: string;
  frontmatter: Record<string, unknown>;
  content: string;
}

export interface ParsedTool {
  name: string;
  description: string;
  filePath: string;
  inputSchema?: Record<string, unknown>;
}

export interface RepoAnalysis {
  skills: ParsedSkill[];
  tools: ParsedTool[];
  plugins: string[];
  readme?: string;
  dependencies: string[];
}

// Fetch result

export interface FetchResult {
  path: string;
  commit: string;
  files: string[];
}
