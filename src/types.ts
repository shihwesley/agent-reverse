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
  userInvocable?: boolean; // If true, install to .claude/commands/ instead of .claude/skills/
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

// Backup types

export interface BackupFile {
  relativePath: string;      // e.g., ".claude/skills/foo.md"
  content: string;           // File contents
  type: 'skill' | 'command' | 'rule' | 'config';
}

export interface BackupManifest {
  version: string;           // AgentReverse version
  createdAt: string;         // ISO timestamp
  sourceAgent: TargetAgent;  // Where this came from
  manifest: Manifest;        // agent-reverse.json content
  files: BackupFile[];       // All skill/config files
  claudeMd?: string;         // CLAUDE.md content
  observerCache?: object;    // workflow-cache.json
  knownRepos?: string[];     // known-repos.json
}

export interface BackupResult {
  success: boolean;
  backupPath?: string;
  gistUrl?: string;
  repoUrl?: string;
  fileCount: number;
  timestamp: string;
  errors: string[];
}

export interface RestoreResult {
  success: boolean;
  filesRestored: string[];
  filesSkipped: string[];
  converted: boolean;        // true if cross-agent restore
  errors: string[];
}

// Security scanning types (Phase 7B)

export type SecuritySeverity = 'critical' | 'medium' | 'low';
export type SecurityCategory =
  | 'remote_execution'
  | 'data_exfiltration'
  | 'secret_access'
  | 'persistence'
  | 'destructive_ops'
  | 'obfuscation';

export interface SecurityPattern {
  category: SecurityCategory;
  severity: SecuritySeverity;
  pattern: string;
  description: string;
}

export interface SecurityFinding {
  category: SecurityCategory;
  severity: SecuritySeverity;
  line: number;
  file: string;
  pattern: string;
  context: string;
}

export interface SecurityReport {
  capabilityId: string;
  riskScore: number;
  findings: SecurityFinding[];
  verdict: 'blocked' | 'needs_confirmation' | 'clear';
  scannedAt: string;
}

// Local introspection types (Phase 7A)

export interface LocalSkillInfo {
  name: string;
  path: string;
  userInvocable: boolean;
  size: number;
  modifiedAt: string;
}

export interface LocalHookInfo {
  event: string;
  command: string;
  path: string;
}

export interface LocalMcpServer {
  name: string;
  transport: string;
  command?: string;
  url?: string;
}

export interface LocalState {
  claudeCodeVersion: string;
  settings: Record<string, unknown>;
  keybindings: Record<string, unknown>;
  skills: LocalSkillInfo[];
  commands: LocalSkillInfo[];
  hooks: LocalHookInfo[];
  mcpServers: LocalMcpServer[];
  agents: string[];
}

export interface LocalStateCache {
  version: string;
  scannedAt: string;
  claudeCodeVersion: string;
  fileHashes: Record<string, string>;
  state: LocalState;
}

export interface OptimizationFinding {
  type: 'dead_skill' | 'deprecated_setting' | 'missing_hook' | 'unhealthy_mcp' | 'duplicate_scope';
  severity: 'safe' | 'breaking' | 'info';
  description: string;
  autoFixable: boolean;
  applied?: boolean;
}

export interface OptimizeResult {
  findings: OptimizationFinding[];
  applied: number;
  needsReview: number;
  backupPath?: string;
}

// Changelog types (Phase 7C)

export interface ChangelogEntry {
  version: string;
  date?: string;
  newFeatures: string[];
  breakingChanges: string[];
  deprecations: string[];
  bugFixes: string[];
  configChanges: string[];
}

export interface MigrationRule {
  pattern: string;
  action: 'rename_setting' | 'remove_setting' | 'add_setting' | 'suggest_hook' | 'info';
  severity: 'safe' | 'breaking' | 'info';
  from?: string;
  to?: string;
  description: string;
  since: string;
}

export interface MigrationResult {
  previousVersion: string;
  currentVersion: string;
  entries: ChangelogEntry[];
  applied: Array<{ rule: MigrationRule; success: boolean }>;
  pendingReview: MigrationRule[];
  infoOnly: string[];
}
