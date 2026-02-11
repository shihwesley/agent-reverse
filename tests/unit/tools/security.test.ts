import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vol } from 'memfs';

vi.mock('fs/promises', async () => {
  const memfs = await import('memfs');
  return memfs.fs.promises;
});

import { scanCapability } from '../../../src/tools/security.js';

describe('Security Scanner', () => {
  beforeEach(() => {
    vol.reset();
  });

  it('should return clear verdict for safe skill', async () => {
    vol.mkdirSync('/source', { recursive: true });
    vol.writeFileSync('/source/skill.md', `---
name: safe-skill
description: A safe skill
---

# Safe Skill

Just does normal things like reading files.`);

    const report = await scanCapability('safe-skill', '/source/skill.md');
    expect(report.verdict).toBe('clear');
    expect(report.riskScore).toBe(0);
    expect(report.findings).toHaveLength(0);
  });

  it('should block on critical: eval()', async () => {
    vol.mkdirSync('/source', { recursive: true });
    vol.writeFileSync('/source/skill.md', `---
name: evil-skill
description: Uses eval
---

Run this code:
\`\`\`
const result = eval(userInput);
\`\`\``);

    const report = await scanCapability('evil-skill', '/source/skill.md');
    expect(report.verdict).toBe('blocked');
    expect(report.findings.some(f => f.category === 'remote_execution')).toBe(true);
    expect(report.findings.some(f => f.severity === 'critical')).toBe(true);
  });

  it('should warn on medium: secret access', async () => {
    vol.mkdirSync('/source', { recursive: true });
    vol.writeFileSync('/source/skill.md', `---
name: key-reader
description: Reads API key
---

Use process.env.ANTHROPIC_API_KEY to authenticate.`);

    const report = await scanCapability('key-reader', '/source/skill.md');
    expect(report.verdict).toBe('needs_confirmation');
    expect(report.findings.some(f => f.category === 'secret_access')).toBe(true);
  });

  it('should allow with info on low: destructive ops', async () => {
    vol.mkdirSync('/source', { recursive: true });
    vol.writeFileSync('/source/skill.md', `---
name: cleaner
description: Cleans up
---

Run git reset --hard to undo changes.`);

    const report = await scanCapability('cleaner', '/source/skill.md');
    expect(report.verdict).toBe('clear');
    expect(report.findings.some(f => f.severity === 'low')).toBe(true);
  });

  it('should calculate risk score from findings', async () => {
    vol.mkdirSync('/source', { recursive: true });
    vol.writeFileSync('/source/skill.md', `---
name: multi-issue
description: Multiple issues
---

eval(something);
process.env.SECRET_KEY
git push --force`);

    const report = await scanCapability('multi-issue', '/source/skill.md');
    expect(report.riskScore).toBeGreaterThan(5);
    expect(report.verdict).toBe('blocked');
  });
});
