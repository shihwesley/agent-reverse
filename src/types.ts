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

export interface ExtractedMcpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  filePath: string;
  lineNumber: number;
}

// Audit types

export interface DuplicateGroup {
  functionality: string;
  capabilities: string[];
  recommendation: string;
}

export type BloatReason = 'orphan' | 'outdated' | 'unused' | 'superseded';

export interface BloatEntry {
  id: string;
  reason: BloatReason;
  details: string;
}

export interface AuditStats {
  total: number;
  installed: number;
  superseded: number;
  orphaned: number;
}

export interface AuditResult {
  duplicates: DuplicateGroup[];
  bloat: BloatEntry[];
  stats: AuditStats;
  consolidationPlan?: string;
}

// Conflict types

export type ConflictStrategy = 'replace' | 'keep_both' | 'synthesize';

export interface ConflictInfo {
  hasConflict: boolean;
  existing?: Capability;
  incoming?: Capability;
  options: ConflictStrategy[];
}

export interface ConflictResolution {
  success: boolean;
  result: 'replaced' | 'renamed' | 'synthesized';
  superseded?: string[];
  newCapability?: Capability;
  synthesisReport?: string;
}

// Dependency types

export interface DepsCheckResult {
  satisfied: boolean;
  missing: string[];
}

export interface DepsResolveResult {
  capability: string;
  dependencies: string[];
  missing: string[];
  installOrder: string[];
  installed?: string[];
  failed?: string[];
  hasCycle?: boolean;
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

// Web synthesis types

export interface WebArticle {
  url: string;
  title: string;
  content: string;
  headings: string[];
  codeBlocks: string[];
  fetchedAt: string;
}

export interface ExtractedConcept {
  coreIdea: string;
  keyPoints: string[];
  suggestedName: string;
  category: string;
  relatedTools?: string[];
}

export interface SynthesizedSkill {
  name: string;
  description: string;
  content: string;
  sourceUrl: string;
  concept: ExtractedConcept;
}

export interface WebInterpretResult {
  success: boolean;
  article?: WebArticle;
  concept?: ExtractedConcept;
  skill?: SynthesizedSkill;
  skillPath?: string;
  error?: string;
}
