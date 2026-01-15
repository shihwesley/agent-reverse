// README instruction parser
// Extract install steps and usage from README.md

export interface ReadmeInfo {
  installSteps: string[];
  usage: string;
  description: string;
}

export function parseReadme(content: string): ReadmeInfo {
  // TODO: Implement in phase1/repo-analyze branch
  return { installSteps: [], usage: '', description: '' };
}
