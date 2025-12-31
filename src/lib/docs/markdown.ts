import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

export interface MarkdownContent {
  title: string;
  description?: string;
  content: string;
}

// Extract title from markdown content (first # heading)
function extractTitle(content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : "Documentation";
}

// Extract description from markdown content (first paragraph after title)
function extractDescription(content: string): string | undefined {
  const lines = content.split("\n");
  let foundTitle = false;

  for (const line of lines) {
    if (line.startsWith("# ")) {
      foundTitle = true;
      continue;
    }
    if (foundTitle && line.trim() && !line.startsWith("#") && !line.startsWith("-") && !line.startsWith("*")) {
      return line.trim();
    }
  }

  return undefined;
}

// Read markdown file and return parsed content
export async function getMarkdownContent(filePath: string): Promise<MarkdownContent | null> {
  const docsDir = path.join(process.cwd(), "docs");
  const fullPath = path.join(docsDir, `${filePath}.md`);

  if (!existsSync(fullPath)) {
    return null;
  }

  try {
    const content = await readFile(fullPath, "utf-8");
    return {
      title: extractTitle(content),
      description: extractDescription(content),
      content,
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
    return getMarkdownContent("public/README");
  }

  // Handle internal docs
  if (slug[0] === "internal") {
    if (slug.length === 1) {
      return getMarkdownContent("internal/README");
    }
    // e.g., /docs/internal/architecture -> internal/architecture/README
    // e.g., /docs/internal/architecture/database -> internal/architecture/database
    const subPath = slug.slice(1);
    if (subPath.length === 1) {
      return getMarkdownContent(`internal/${subPath[0]}/README`);
    }
    return getMarkdownContent(`internal/${subPath.join("/")}`);
  }

  // Handle public docs
  // e.g., /docs/guides -> public/guides/README
  // e.g., /docs/guides/getting-started -> public/guides/getting-started
  // e.g., /docs/api -> public/api/README
  if (slug.length === 1) {
    return getMarkdownContent(`public/${slug[0]}/README`);
  }

  return getMarkdownContent(`public/${slug.join("/")}`);
}

// Get all docs paths for static generation
export function getAllDocsPaths(): string[][] {
  const paths: string[][] = [];

  // Root
  paths.push([]);

  // Public guides
  paths.push(["guides"]);
  const guides = [
    "getting-started",
    "organization-management",
    "video-organization",
    "collaboration",
    "team-management",
    "settings-preferences",
    "troubleshooting",
  ];
  for (const guide of guides) {
    paths.push(["guides", guide]);
  }

  // Public API
  paths.push(["api"]);
  const apiDocs = ["authentication", "videos", "organizations", "comments", "notifications", "ai", "errors"];
  for (const api of apiDocs) {
    paths.push(["api", api]);
  }

  // Internal architecture
  paths.push(["internal"]);
  paths.push(["internal", "architecture"]);
  const architectureDocs = [
    "authentication",
    "database",
    "frontend",
    "backend",
    "video-processing",
    "effect-ts",
    "accessibility",
    "deployment",
    "summary",
  ];
  for (const doc of architectureDocs) {
    paths.push(["internal", "architecture", doc]);
  }

  // Internal reference
  paths.push(["internal", "reference"]);
  const referenceDocs = [
    "development-setup",
    "database-setup",
    "environment-config",
    "components",
    "hooks",
    "styling",
    "testing",
    "migrations",
    "data-integrity",
    "contributing",
  ];
  for (const doc of referenceDocs) {
    paths.push(["internal", "reference", doc]);
  }

  return paths;
}
