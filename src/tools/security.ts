// security_scan tool — Phase 7B
// Pattern-based security scanning for capabilities before install
// Zero LLM cost — regex only

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readFile } from 'fs/promises';
import { SECURITY_PATTERNS } from '../data/security-patterns.js';
import type { SecurityFinding, SecurityReport, SecuritySeverity } from '../types.js';

const SEVERITY_WEIGHTS: Record<SecuritySeverity, number> = {
  critical: 4,
  medium: 2,
  low: 1,
};

export async function scanCapability(
  capabilityId: string,
  filePath: string
): Promise<SecurityReport> {
  const content = await readFile(filePath, 'utf-8');
  const lines = content.split('\n');
  const findings: SecurityFinding[] = [];

  for (const patternDef of SECURITY_PATTERNS) {
    const regex = new RegExp(patternDef.pattern, 'gi');

    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        findings.push({
          category: patternDef.category,
          severity: patternDef.severity,
          line: i + 1,
          file: filePath,
          pattern: patternDef.description,
          context: lines[i].trim().substring(0, 120),
        });
      }
      regex.lastIndex = 0;
    }
  }

  const rawScore = findings.reduce((sum, f) => sum + SEVERITY_WEIGHTS[f.severity], 0);
  const riskScore = Math.min(10, rawScore);

  const hasCritical = findings.some(f => f.severity === 'critical');
  const hasMedium = findings.some(f => f.severity === 'medium');

  let verdict: SecurityReport['verdict'] = 'clear';
  if (hasCritical) verdict = 'blocked';
  else if (hasMedium) verdict = 'needs_confirmation';

  return {
    capabilityId,
    riskScore,
    findings,
    verdict,
    scannedAt: new Date().toISOString(),
  };
}

export function registerSecurityTools(server: McpServer): void {
  server.registerTool(
    'security_scan',
    {
      description: 'Scan a capability file for security issues before install. Checks 6 categories: remote execution, data exfiltration, secret access, persistence, destructive ops, obfuscation.',
      inputSchema: {
        capabilityId: z.string().describe('ID of the capability being scanned'),
        filePath: z.string().describe('Absolute path to the skill/capability file'),
      },
    },
    async ({ capabilityId, filePath }) => {
      try {
        const report = await scanCapability(capabilityId, filePath);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(report, null, 2) }],
          isError: false,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Security scan failed: ${message}` }],
          isError: true,
        };
      }
    }
  );
}
