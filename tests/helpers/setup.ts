import { vi, beforeEach, afterEach } from 'vitest';
import { vol } from 'memfs';

// Reset virtual filesystem before each test
beforeEach(() => {
  vol.reset();
});

// Clear all mocks after each test
afterEach(() => {
  vi.clearAllMocks();
});

// Helper to create temp directory in virtual fs
export function createTempDir(path: string = '/tmp/test'): string {
  vol.mkdirSync(path, { recursive: true });
  return path;
}

// Helper to write file in virtual fs
export function writeTestFile(path: string, content: string): void {
  const dir = path.substring(0, path.lastIndexOf('/'));
  vol.mkdirSync(dir, { recursive: true });
  vol.writeFileSync(path, content);
}

// Helper to read file from virtual fs
export function readTestFile(path: string): string {
  return vol.readFileSync(path, 'utf8') as string;
}

// Helper to check if file exists in virtual fs
export function fileExists(path: string): boolean {
  try {
    vol.statSync(path);
    return true;
  } catch {
    return false;
  }
}
