import { describe, it, expect, vi, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import { vol } from 'memfs';
import { fetchArticle, extractConcept, synthesizeSkill, interpretWeb } from '../../../src/tools/web.js';
import { server } from '../../mocks/http.js';

// Mock fs/promises with memfs
vi.mock('fs/promises', async () => {
  const memfs = await import('memfs');
  return memfs.fs.promises;
});

describe('Web Tool', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  beforeEach(() => {
    vol.reset();
    vol.mkdirSync('/project/.claude/skills', { recursive: true });
  });

  describe('fetchArticle', () => {
    it('should fetch and parse URL content', async () => {
      const result = await fetchArticle('https://example.com/blog/skill-tutorial');

      expect(result.url).toBe('https://example.com/blog/skill-tutorial');
      expect(result.title).toBe('How to Build Skills');
      expect(result.content).toContain('create a markdown file');
    });

    it('should extract headings', async () => {
      const result = await fetchArticle('https://example.com/blog/skill-tutorial');

      expect(result.headings).toContain('How to Build Skills');
      expect(result.headings).toContain('Introduction');
      expect(result.headings).toContain('Implementation');
    });

    it('should extract code blocks', async () => {
      const result = await fetchArticle('https://example.com/blog/skill-tutorial');

      expect(result.codeBlocks.length).toBeGreaterThan(0);
      expect(result.codeBlocks.some(b => b.includes('My Skill'))).toBe(true);
    });

    it('should handle 404 errors', async () => {
      await expect(fetchArticle('https://example.com/404'))
        .rejects.toThrow(/404/);
    });

    it('should include fetch timestamp', async () => {
      const result = await fetchArticle('https://example.com/blog/skill-tutorial');

      expect(result.fetchedAt).toBeDefined();
      expect(new Date(result.fetchedAt).getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('extractConcept', () => {
    it('should extract core idea from article', async () => {
      const article = await fetchArticle('https://example.com/blog/skill-tutorial');
      const concept = extractConcept(article);

      expect(concept.coreIdea).toBeDefined();
      expect(concept.coreIdea.length).toBeGreaterThan(0);
    });

    it('should extract key points', async () => {
      const article = await fetchArticle('https://example.com/blog/skill-tutorial');
      const concept = extractConcept(article);

      expect(concept.keyPoints).toBeDefined();
      expect(Array.isArray(concept.keyPoints)).toBe(true);
    });

    it('should suggest a name', async () => {
      const article = await fetchArticle('https://example.com/blog/skill-tutorial');
      const concept = extractConcept(article);

      expect(concept.suggestedName).toBeDefined();
      expect(concept.suggestedName.length).toBeGreaterThan(0);
    });

    it('should categorize the concept', async () => {
      const article = await fetchArticle('https://example.com/code-article');
      const concept = extractConcept(article);

      expect(concept.category).toBeDefined();
    });
  });

  describe('synthesizeSkill', () => {
    it('should create skill from article and concept', async () => {
      const article = await fetchArticle('https://example.com/blog/skill-tutorial');
      const concept = extractConcept(article);
      const skill = synthesizeSkill(article, concept);

      expect(skill.name).toBeDefined();
      expect(skill.description).toBeDefined();
      expect(skill.content).toContain('#');
    });

    it('should use custom name if provided', async () => {
      const article = await fetchArticle('https://example.com/blog/skill-tutorial');
      const concept = extractConcept(article);
      const skill = synthesizeSkill(article, concept, 'my-custom-skill');

      expect(skill.name).toBe('my-custom-skill');
    });

    it('should preserve source URL', async () => {
      const article = await fetchArticle('https://example.com/blog/skill-tutorial');
      const concept = extractConcept(article);
      const skill = synthesizeSkill(article, concept);

      expect(skill.sourceUrl).toBe('https://example.com/blog/skill-tutorial');
    });

    it('should include concept in skill', async () => {
      const article = await fetchArticle('https://example.com/blog/skill-tutorial');
      const concept = extractConcept(article);
      const skill = synthesizeSkill(article, concept);

      expect(skill.concept).toBe(concept);
    });
  });

  describe('interpretWeb', () => {
    it('should complete full pipeline successfully', async () => {
      const result = await interpretWeb(
        'https://example.com/blog/skill-tutorial',
        '/project',
        { saveToManifest: false }
      );

      expect(result.success).toBe(true);
      expect(result.article).toBeDefined();
      expect(result.concept).toBeDefined();
      expect(result.skill).toBeDefined();
      expect(result.skillPath).toBeDefined();
    });

    it('should write skill file to disk', async () => {
      const result = await interpretWeb(
        'https://example.com/blog/skill-tutorial',
        '/project',
        { saveToManifest: false }
      );

      expect(result.success).toBe(true);
      expect(result.skillPath).toBeDefined();
      expect(vol.existsSync(`/project/${result.skillPath}`)).toBe(true);
    });

    it('should handle fetch errors gracefully', async () => {
      const result = await interpretWeb(
        'https://example.com/404',
        '/project'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('404');
    });

    it('should use custom skill name', async () => {
      const result = await interpretWeb(
        'https://example.com/blog/skill-tutorial',
        '/project',
        { skillName: 'custom-name', saveToManifest: false }
      );

      expect(result.success).toBe(true);
      expect(result.skill?.name).toBe('custom-name');
    });

    it('should add to manifest when saveToManifest is true', async () => {
      // First ensure manifest exists
      vol.writeFileSync('/project/agent-reverse.json', JSON.stringify({
        version: '1.0',
        targetAgent: 'claude-code',
        capabilities: [],
        superseded: [],
      }));

      const result = await interpretWeb(
        'https://example.com/blog/skill-tutorial',
        '/project',
        { saveToManifest: true }
      );

      expect(result.success).toBe(true);

      const manifest = JSON.parse(vol.readFileSync('/project/agent-reverse.json', 'utf8') as string);
      expect(manifest.capabilities.length).toBeGreaterThan(0);
    });
  });
});
