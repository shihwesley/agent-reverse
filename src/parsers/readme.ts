// README instruction parser
// Extract install steps and usage from README.md

export interface ReadmeInfo {
  title: string;
  description: string;
  installSteps: string[];
  usage: string;
  dependencies: string[];
}

// Section header patterns
const INSTALL_HEADERS = /^#{1,3}\s*(install|installation|setup|getting started|quick start)/im;
const USAGE_HEADERS = /^#{1,3}\s*(usage|how to use|examples?|basic usage)/im;
const DEPS_HEADERS = /^#{1,3}\s*(dependenc|requirements|prerequisites)/im;

export function parseReadme(content: string): ReadmeInfo {
  const lines = content.split('\n');

  // Extract title (first # heading)
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch?.[1]?.trim() || '';

  // Extract description (first paragraph after title)
  const description = extractFirstParagraph(content);

  // Extract install steps
  const installSteps = extractSection(content, INSTALL_HEADERS);

  // Extract usage
  const usage = extractSection(content, USAGE_HEADERS).join('\n');

  // Extract dependencies from package.json references or deps section
  const dependencies = extractDependencies(content);

  return {
    title,
    description,
    installSteps,
    usage,
    dependencies,
  };
}

function extractFirstParagraph(content: string): string {
  // Skip title line
  const withoutTitle = content.replace(/^#\s+.+\n+/, '');

  // Find first non-empty, non-heading line sequence
  const lines = withoutTitle.split('\n');
  const paragraphLines: string[] = [];
  let started = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip badges, empty lines at start
    if (!started) {
      if (!trimmed || trimmed.startsWith('![') || trimmed.startsWith('[!')) continue;
      if (trimmed.startsWith('#')) break;
      started = true;
    }

    if (started) {
      if (!trimmed || trimmed.startsWith('#')) break;
      paragraphLines.push(trimmed);
    }
  }

  return paragraphLines.join(' ').slice(0, 500); // Limit length
}

function extractSection(content: string, headerPattern: RegExp): string[] {
  const match = content.match(headerPattern);
  if (!match) return [];

  const startIndex = match.index! + match[0].length;
  const rest = content.slice(startIndex);

  // Find next heading of same or higher level
  const headerLevel = match[0].match(/^#+/)?.[0].length || 1;
  const endPattern = new RegExp(`^#{1,${headerLevel}}\\s+`, 'm');
  const endMatch = rest.match(endPattern);

  const sectionContent = endMatch ? rest.slice(0, endMatch.index) : rest;

  // Extract code blocks or list items
  const steps: string[] = [];

  // Extract numbered/bulleted list items
  const listItems = sectionContent.match(/^[\s]*[-*\d.]+\s+.+$/gm);
  if (listItems) {
    steps.push(...listItems.map(item => item.replace(/^[\s]*[-*\d.]+\s+/, '').trim()));
  }

  // Extract code blocks
  const codeBlocks = sectionContent.match(/```[\s\S]*?```/g);
  if (codeBlocks) {
    steps.push(...codeBlocks.map(block =>
      block.replace(/```\w*\n?/, '').replace(/```$/, '').trim()
    ));
  }

  return steps;
}

function extractDependencies(content: string): string[] {
  const deps: string[] = [];

  // Look for npm install commands
  const npmInstalls = content.match(/npm\s+install\s+([^\n`]+)/g);
  if (npmInstalls) {
    for (const cmd of npmInstalls) {
      const packages = cmd
        .replace(/npm\s+install\s+/, '')
        .replace(/--save(-dev)?/g, '')
        .replace(/-[DdEe]\s*/g, '')
        .trim()
        .split(/\s+/)
        .filter(p => p && !p.startsWith('-'));
      deps.push(...packages);
    }
  }

  // Look for package names in deps section
  const depsSection = extractSection(content, DEPS_HEADERS);
  for (const line of depsSection) {
    // Match package-like names (scoped or unscoped)
    const pkgMatches = line.match(/@?[\w-]+\/[\w-]+|[\w][\w-]*/g);
    if (pkgMatches) {
      deps.push(...pkgMatches.filter(p =>
        !['the', 'and', 'or', 'a', 'an', 'to', 'for', 'with'].includes(p.toLowerCase())
      ));
    }
  }

  return [...new Set(deps)]; // Dedupe
}
