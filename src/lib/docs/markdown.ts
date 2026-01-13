import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

export interface MarkdownContent {
  title: string;
  description?: string;
  content: string;
}

// Extract title from markdown content (first # heading)
function extractTitle(content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : 'Documentation';
}

// Extract description from markdown content (first paragraph or blockquote after title)
function extractDescription(content: string): string | undefined {
  const lines = content.split('\n');
  let foundTitle = false;

  for (const line of lines) {
    if (line.startsWith('# ')) {
      foundTitle = true;
      continue;
    }
    if (foundTitle && line.trim() && !line.startsWith('#') && !line.startsWith('-') && !line.startsWith('*')) {
      // Remove blockquote marker if present
      const cleanLine = line.startsWith('>') ? line.slice(1).trim() : line.trim();
      return cleanLine;
    }
  }

  return undefined;
}

// Strip the first h1 heading from content (since it's displayed separately by DocsTitle)
function stripFirstHeading(content: string): string {
  const lines = content.split('\n');
  let foundFirstH1 = false;
  const result: string[] = [];

  for (const line of lines) {
    if (!foundFirstH1 && line.match(/^#\s+.+$/)) {
      foundFirstH1 = true;
      continue; // Skip the first h1
    }
    result.push(line);
  }

  // Also remove leading empty lines after stripping the heading
  while (result.length > 0 && result[0].trim() === '') {
    result.shift();
  }

  return result.join('\n');
}

// Read markdown file and return parsed content
export async function getMarkdownContent(filePath: string): Promise<MarkdownContent | null> {
  const docsDir = path.join(process.cwd(), 'docs');
  const fullPath = path.join(docsDir, `${filePath}.md`);

  if (!existsSync(fullPath)) {
    return null;
  }

  try {
    const rawContent = await readFile(fullPath, 'utf-8');
    return {
      title: extractTitle(rawContent),
      description: extractDescription(rawContent),
      content: stripFirstHeading(rawContent),
    };
  } catch (error) {
    console.error(`Error reading markdown file: ${fullPath}`, error);
    return null;
  }
}

// Get docs content based on slug
export async function getDocsContent(slug: string[]): Promise<MarkdownContent | null> {
  // Handle root docs page
  if (slug.length === 0) {
    return getMarkdownContent('public/README');
  }

  // Handle internal docs
  if (slug[0] === 'internal') {
    if (slug.length === 1) {
      return getMarkdownContent('internal/README');
    }
    // e.g., /docs/internal/architecture -> internal/architecture/README
    // e.g., /docs/internal/architecture/database -> internal/architecture/database
    const subPath = slug.slice(1);
    if (subPath.length === 1) {
      return getMarkdownContent(`internal/${subPath[0]}/README`);
    }
    return getMarkdownContent(`internal/${subPath.join('/')}`);
  }

  // Handle public docs
  // e.g., /docs/guides -> public/guides/README
  // e.g., /docs/guides/getting-started -> public/guides/getting-started
  // e.g., /docs/api -> public/api/README
  if (slug.length === 1) {
    return getMarkdownContent(`public/${slug[0]}/README`);
  }

  return getMarkdownContent(`public/${slug.join('/')}`);
}

// Get all docs paths for static generation
export function getAllDocsPaths(): string[][] {
  const paths: string[][] = [];

  // Root
  paths.push([]);

  // Public guides
  paths.push(['guides']);
  const guides = [
    'getting-started',
    'organization-management',
    'video-organization',
    'collaboration',
    'team-management',
    'settings-preferences',
    'troubleshooting',
  ];
  for (const guide of guides) {
    paths.push(['guides', guide]);
  }

  // Public API
  paths.push(['api']);
  const apiDocs = ['authentication', 'videos', 'organizations', 'comments', 'notifications', 'ai', 'errors'];
  for (const api of apiDocs) {
    paths.push(['api', api]);
  }

  // Internal architecture
  paths.push(['internal']);
  paths.push(['internal', 'architecture']);
  const architectureDocs = [
    'authentication',
    'database',
    'frontend',
    'backend',
    'video-processing',
    'effect-ts',
    'accessibility',
    'deployment',
    'summary',
  ];
  for (const doc of architectureDocs) {
    paths.push(['internal', 'architecture', doc]);
  }

  // Internal reference
  paths.push(['internal', 'reference']);
  const referenceDocs = [
    'development-setup',
    'database-setup',
    'environment-config',
    'components',
    'hooks',
    'styling',
    'testing',
    'migrations',
    'data-integrity',
    'contributing',
  ];
  for (const doc of referenceDocs) {
    paths.push(['internal', 'reference', doc]);
  }

  return paths;
}
