// Migration rules: map Claude Code changelog patterns to local actions
// Static rules for known changes. LLM fallback for unknown entries handled in changelog.ts.

import type { MigrationRule } from '../types.js';

export const MIGRATION_RULES: MigrationRule[] = [
  {
    pattern: 'deprecated.*allowedTools',
    action: 'rename_setting',
    severity: 'safe',
    from: 'allowedTools',
    to: 'permissions.allow',
    description: 'allowedTools renamed to permissions.allow',
    since: '2.1.0',
  },
  {
    pattern: 'removed.*model.*preference',
    action: 'remove_setting',
    severity: 'breaking',
    from: 'preferredModel',
    description: 'Model preference setting removed — now uses project config',
    since: '2.0.0',
  },
  {
    pattern: 'new.*hook.*type',
    action: 'suggest_hook',
    severity: 'info',
    description: 'New hook type available — check if existing hooks should migrate',
    since: '2.0.0',
  },
];
