# AgentReverse Test Suite

## Overview

Comprehensive test coverage for 23 MCP tools, 3 adapters, 3 parsers, and workflows.

**201 tests** across 25 test files.

## Running Tests

```bash
# All tests
npm test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage

# Specific test types
npm run test:unit
npm run test:integration
npm run test:e2e

# E2E with network tests
E2E_NETWORK=true npm run test:e2e
```

## Test Structure

```
tests/
├── unit/              # Isolated unit tests
│   ├── parsers/       # skill, readme, mcp parsers
│   ├── adapters/      # claude, cursor, antigravity
│   └── tools/         # fetch, analyze, manifest, install, sync,
│                      # observer, suggester, audit, conflict, deps, web
├── integration/       # Cross-module tests
│   ├── fetch-analyze-install.test.ts
│   ├── manifest-sync.test.ts
│   ├── audit-conflict.test.ts
│   ├── observer-suggester.test.ts
│   └── multi-agent.test.ts
├── e2e/               # End-to-end tests
│   ├── helpers/       # MCP test client
│   ├── server.test.ts # MCP server tool tests
│   └── workflow.test.ts # CLI workflow tests
├── fixtures/          # Test data and sample files
└── mocks/             # Mock implementations
    ├── factories.ts   # Test data factories
    └── http.ts        # HTTP mock (msw)
```

## Coverage Targets

- Statements: 80%
- Branches: 75%
- Functions: 80%
- Lines: 80%

## Writing Tests

### Unit Tests
- One test file per module
- Use factories from `tests/mocks/factories.ts`
- Mock external dependencies (fs, git, network)

### Integration Tests
- Test workflows across modules
- Use virtual filesystem (memfs)
- Focus on data flow and state changes

### E2E Tests
- Test actual MCP server via stdio
- May require network access (set `E2E_NETWORK=true`)
- Use longer timeouts

## Mocking Patterns

### Filesystem (memfs)
```typescript
import { vol } from 'memfs';

vi.mock('fs/promises', async () => {
  const memfs = await import('memfs');
  return memfs.fs.promises;
});

beforeEach(() => vol.reset());
```

### Git (simple-git)
```typescript
const mockGit = {
  clone: vi.fn().mockResolvedValue(undefined),
  log: vi.fn().mockResolvedValue({ latest: { hash: 'abc123' } }),
};

vi.mock('simple-git', () => ({
  simpleGit: vi.fn(() => mockGit),
}));
```

### HTTP (msw)
```typescript
import { server } from '../mocks/http.js';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## Test Factories

```typescript
import { createMockManifest, createMockCapability } from '../mocks/factories.js';

const manifest = createMockManifest({
  capabilities: [
    createMockCapability({ id: 'test', source: 'https://github.com/test/repo' }),
  ],
});
```
