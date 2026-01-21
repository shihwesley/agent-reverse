import { describe, it, expect } from 'vitest';
import { parseReadme } from '../../../src/parsers/readme.js';

describe('README Parser', () => {
  describe('parseReadme', () => {
    it('should extract title from first heading', () => {
      const content = `# My Amazing Project

Description here.`;

      const result = parseReadme(content);

      expect(result.title).toBe('My Amazing Project');
    });

    it('should extract description from first paragraph', () => {
      const content = `# Project

This is the description of the project.

## Installation

Steps here.`;

      const result = parseReadme(content);

      expect(result.description).toContain('description of the project');
    });

    it('should extract installation steps', () => {
      const content = `# Project

## Installation

\`\`\`bash
npm install my-package
\`\`\`

## Usage

Use it like this.`;

      const result = parseReadme(content);

      expect(result.installSteps.length).toBeGreaterThan(0);
      expect(result.installSteps.some(s => s.includes('npm install'))).toBe(true);
    });

    it('should extract usage section', () => {
      const content = `# Project

## Usage

Call the function:
\`\`\`javascript
myFunction();
\`\`\``;

      const result = parseReadme(content);

      expect(result.usage).toContain('myFunction');
    });

    it('should extract dependencies', () => {
      const content = `# Project

## Dependencies

- lodash
- express
- typescript`;

      const result = parseReadme(content);

      expect(result.dependencies).toContain('lodash');
      expect(result.dependencies).toContain('express');
    });

    it('should handle missing sections gracefully', () => {
      const content = `# Minimal Project

Just a title and description.`;

      const result = parseReadme(content);

      expect(result.title).toBe('Minimal Project');
      expect(result.installSteps).toEqual([]);
      expect(result.usage).toBe('');
      expect(result.dependencies).toEqual([]);
    });

    it('should handle empty content', () => {
      const result = parseReadme('');

      expect(result.title).toBe('');
      expect(result.description).toBe('');
    });

    it('should recognize alternative install headers', () => {
      const content = `# Project

## Getting Started

\`\`\`bash
npm install
npm start
\`\`\``;

      const result = parseReadme(content);

      // "Getting Started" should match install pattern
      expect(result.installSteps.some(s => s.includes('npm'))).toBe(true);
    });

    it('should extract requirements as dependencies', () => {
      const content = `# Project

## Requirements

- Node.js >= 18
- npm >= 9`;

      const result = parseReadme(content);

      expect(result.dependencies.length).toBeGreaterThan(0);
    });
  });
});
