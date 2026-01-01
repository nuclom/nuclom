#!/usr/bin/env npx tsx

/**
 * OpenAPI Spec Generator CLI
 *
 * Automatically generates OpenAPI spec by parsing all route.ts files in the API directory.
 *
 * Usage:
 *   pnpm openapi:generate [options]
 *
 * Options:
 *   --output, -o    Output file path (default: prints to stdout)
 *   --format, -f    Output format: json or yaml (default: json)
 *   --verbose       Print detailed parsing info
 */

import * as fs from "node:fs";
import * as path from "node:path";
import process from "node:process";
import { specToYaml } from "../src/lib/openapi";
import { generateAutoSpec } from "../src/lib/openapi/auto-endpoints";
import { RouteParser } from "../src/lib/openapi/route-parser";

// =============================================================================
// CLI Implementation
// =============================================================================

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    output: undefined as string | undefined,
    format: "json" as "json" | "yaml",
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--output":
      case "-o":
        options.output = args[++i];
        break;
      case "--format":
      case "-f":
        options.format = args[++i] as "json" | "yaml";
        break;
      case "--verbose":
        options.verbose = true;
        break;
    }
  }

  return options;
}

function main() {
  const options = parseArgs();
  const projectRoot = path.resolve(import.meta.dirname, "..");

  console.error("🔍 Parsing route files...\n");

  if (options.verbose) {
    const parser = new RouteParser({ projectRoot });
    const routes = parser.parseAllRoutes();

    console.error(`Found ${routes.length} route files:\n`);
    for (const route of routes) {
      console.error(`  ${route.apiPath}`);
      for (const method of route.methods) {
        console.error(`    ${method.method.toUpperCase()} - auth: ${method.requiresAuth}`);
        if (method.requestSchema) console.error(`      request: ${method.requestSchema}`);
        if (method.querySchema) console.error(`      query: ${method.querySchema}`);
      }
    }
    console.error("");
  }

  console.error("📝 Generating OpenAPI spec...\n");

  // Generate spec
  const spec = generateAutoSpec(projectRoot);

  console.error(`✅ Generated spec with ${Object.keys(spec.paths).length} paths\n`);

  // Format output
  const output = options.format === "yaml" ? specToYaml(spec) : JSON.stringify(spec, null, 2);

  if (options.output) {
    fs.writeFileSync(options.output, output);
    console.error(`📄 Written to ${options.output}`);
  } else {
    console.log(output);
  }
}

main();
