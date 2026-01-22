import { describe, it, expect, vi, beforeEach } from 'vitest';
import { vol } from 'memfs';

// Mock fs/promises with memfs
vi.mock('fs/promises', async () => {
  const memfs = await import('memfs');
  return memfs.fs.promises;
});

// Import after mocks
import { logEvent, getPatterns, clearCache, loadCache } from '../../src/tools/observer.js';
import { createMockManifest } from '../mocks/factories.js';

describe('Integration: Observer → Suggester Flow', () => {
  beforeEach(() => {
    vol.reset();
    vol.mkdirSync('/project', { recursive: true });
    vol.writeFileSync('/project/agent-reverse.json', JSON.stringify(createMockManifest()));
  });

  it('should track workflow events and detect patterns', async () => {
    // Simulate repeated git operations
    const gitEvents = [
      { type: 'tool_invocation' as const, trigger: 'git_status', context: { command: 'git status' } },
      { type: 'tool_invocation' as const, trigger: 'git_add', context: { command: 'git add .' } },
      { type: 'tool_invocation' as const, trigger: 'git_commit', context: { command: 'git commit' } },
    ];

    // Log events multiple times to build frequency
    for (let i = 0; i < 4; i++) {
      for (const event of gitEvents) {
        await logEvent('/project', event.type, event.trigger, event.context);
      }
    }

    // Check patterns
    const patterns = await getPatterns('/project');
    expect(patterns.length).toBeGreaterThan(0);
    expect(patterns.some(p => p.frequency >= 3)).toBe(true);
  });

  it('should persist patterns across sessions', async () => {
    // Log some events to create patterns
    for (let i = 0; i < 5; i++) {
      await logEvent('/project', 'tool_invocation', 'search', { query: 'test' });
    }

    // Reload cache - should have patterns not events
    const cache = await loadCache('/project');

    expect(cache.patterns.length).toBeGreaterThan(0);
    expect(cache.patterns[0].trigger).toBe('search');
  });

  it('should clear cache', async () => {
    // Log events to create patterns
    for (let i = 0; i < 5; i++) {
      await logEvent('/project', 'manual_action', 'trigger1', {});
    }

    // Verify patterns exist
    let cache = await loadCache('/project');
    expect(cache.patterns.length).toBeGreaterThan(0);

    // Clear cache
    await clearCache('/project');

    // Verify cleared
    cache = await loadCache('/project');
    expect(cache.patterns).toHaveLength(0);
  });

  it('should identify friction patterns from errors', async () => {
    // Simulate repeated errors
    for (let i = 0; i < 5; i++) {
      await logEvent('/project', 'error', 'test_failure', { message: 'Tests failed' });
    }

    const patterns = await getPatterns('/project');

    // Should have detected repeated error pattern
    expect(patterns.some(p => p.trigger === 'test_failure' && p.frequency >= 3)).toBe(true);
  });

  it('should handle empty project gracefully', async () => {
    // New project with no events - returns default cache
    const patterns = await getPatterns('/project');
    expect(patterns).toEqual([]);

    const cache = await loadCache('/project');
    expect(cache.patterns).toEqual([]);
  });
});
