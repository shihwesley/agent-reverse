// Security scanning patterns — 6 categories, tiered severity
// Pattern-based only (regex), no LLM cost

import type { SecurityPattern } from '../types.js';

export const SECURITY_PATTERNS: SecurityPattern[] = [
  // CRITICAL: Remote execution
  {
    category: 'remote_execution',
    severity: 'critical',
    pattern: '\\beval\\s*\\(',
    description: 'eval() can execute arbitrary code',
  },
  {
    category: 'remote_execution',
    severity: 'critical',
    pattern: '\\bnew\\s+Function\\s*\\(',
    description: 'Function constructor can execute arbitrary code',
  },
  {
    category: 'remote_execution',
    severity: 'critical',
    pattern: '\\b(?:exec|execSync|spawn|spawnSync)\\s*\\(',
    description: 'Shell execution can run arbitrary commands',
  },
  {
    category: 'remote_execution',
    severity: 'critical',
    pattern: '\\bchild_process\\b',
    description: 'child_process module enables shell execution',
  },
  {
    category: 'remote_execution',
    severity: 'critical',
    pattern: '\\brequire\\s*\\(\\s*[^"\'`]',
    description: 'Dynamic require() can load arbitrary modules',
  },
  {
    category: 'remote_execution',
    severity: 'critical',
    pattern: '\\bimport\\s*\\(\\s*[^"\'`]',
    description: 'Dynamic import() can load arbitrary modules',
  },

  // CRITICAL: Data exfiltration
  {
    category: 'data_exfiltration',
    severity: 'critical',
    pattern: '\\bfetch\\s*\\(.*(?:readFile|readFileSync|fs\\.|homedir)',
    description: 'Network call with local file content',
  },
  {
    category: 'data_exfiltration',
    severity: 'critical',
    pattern: '(?:https?://|wss?://).*(?:btoa|Buffer\\.from|base64)',
    description: 'Encoded data sent to external URL',
  },
  {
    category: 'data_exfiltration',
    severity: 'critical',
    pattern: '\\bXMLHttpRequest\\b|\\bnavigator\\.sendBeacon\\b',
    description: 'Browser-style data exfiltration pattern',
  },

  // MEDIUM: Secret access
  {
    category: 'secret_access',
    severity: 'medium',
    pattern: 'process\\.env\\.\\w*(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH)\\w*',
    description: 'Reads sensitive environment variable',
  },
  {
    category: 'secret_access',
    severity: 'medium',
    pattern: '(?:~|\\/home\\/\\w+|\\$HOME)\\/\\.(?:ssh|aws|gnupg|config\\/gcloud)',
    description: 'Accesses credential directories',
  },
  {
    category: 'secret_access',
    severity: 'medium',
    pattern: '\\.(?:env|pem|key|p12|pfx|jks)\\b',
    description: 'References credential file types',
  },

  // MEDIUM: Persistence
  {
    category: 'persistence',
    severity: 'medium',
    pattern: '\\bcrontab\\b|\\bcron\\b.*\\bwrite\\b',
    description: 'Modifies cron schedule',
  },
  {
    category: 'persistence',
    severity: 'medium',
    pattern: 'launchd|LaunchAgent|LaunchDaemon|\\.plist\\b',
    description: 'Modifies macOS launch agents',
  },
  {
    category: 'persistence',
    severity: 'medium',
    pattern: '\\.(?:bashrc|zshrc|profile|bash_profile)\\b.*(?:write|append|>>)',
    description: 'Modifies shell profile for persistence',
  },
  {
    category: 'persistence',
    severity: 'medium',
    pattern: '\\bsystemd\\b|\\bsystemctl\\b|\\.service\\b',
    description: 'Modifies systemd services',
  },

  // LOW: Destructive operations
  {
    category: 'destructive_ops',
    severity: 'low',
    pattern: '\\brm\\s+-rf\\b|\\brmdir\\b.*recursive',
    description: 'Recursive file deletion',
  },
  {
    category: 'destructive_ops',
    severity: 'low',
    pattern: '\\bDROP\\s+(?:TABLE|DATABASE)\\b',
    description: 'Drops database objects',
  },
  {
    category: 'destructive_ops',
    severity: 'low',
    pattern: '\\bgit\\s+push\\s+--force\\b|\\bgit\\s+reset\\s+--hard\\b',
    description: 'Destructive git operation',
  },

  // LOW: Obfuscation
  {
    category: 'obfuscation',
    severity: 'low',
    pattern: '(?:atob|btoa|Buffer\\.from)\\s*\\(\\s*["\'][A-Za-z0-9+/=]{50,}',
    description: 'Long encoded string (possible hidden payload)',
  },
  {
    category: 'obfuscation',
    severity: 'low',
    pattern: 'String\\.fromCharCode\\s*\\((?:\\s*\\d+\\s*,){5,}',
    description: 'String built from char codes (obfuscation)',
  },
  {
    category: 'obfuscation',
    severity: 'low',
    pattern: '\\b(?:0x[a-f0-9]{2}){8,}\\b',
    description: 'Hex-encoded data',
  },
  {
    category: 'obfuscation',
    severity: 'low',
    pattern: '\\b[a-f0-9]{32,}\\b(?!commit|sha|hash)',
    description: 'Suspicious hex-only identifier (not a hash reference)',
  },
];
