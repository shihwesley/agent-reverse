import { vi } from 'vitest';

export const mockSimpleGit = {
  clone: vi.fn().mockResolvedValue(undefined),
  revparse: vi.fn().mockResolvedValue('abc123def456'),
  log: vi.fn().mockResolvedValue({ latest: { hash: 'abc123def456' } }),
  fetch: vi.fn().mockResolvedValue(undefined),
  checkout: vi.fn().mockResolvedValue(undefined),
  raw: vi.fn().mockResolvedValue(''),
};

export function createMockGit() {
  return vi.fn(() => mockSimpleGit);
}

export function resetGitMocks() {
  Object.values(mockSimpleGit).forEach((mock) => mock.mockClear());
}
