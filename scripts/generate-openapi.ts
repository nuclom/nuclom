#!/usr/bin/env npx tsx

/**
 * OpenAPI Spec Generator CLI
 *
 * Automatically generates OpenAPI spec by parsing all route.ts files in the API directory.
 *
 * Usage:
 *   pnpm openapi [options]
 *
 * Options:
 *   --stdout        Output to stdout instead of files (use with --format)
 *   --format, -f    Output format for stdout: json or yaml (default: json)
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
    stdout: false,
    format: "json" as "json" | "yaml",
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "--stdout":
        options.stdout = true;
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
  const jsonPath = path.join(projectRoot, "public", "openapi.json");
  const yamlPath = path.join(projectRoot, "public", "openapi.yaml");

  // Use console.error for status messages so stdout remains clean for --stdout mode
  const log = options.stdout ? console.error : console.log;

  log("🔍 Parsing route files...");

  if (options.verbose) {
    const parser = new RouteParser({ projectRoot });
    const routes = parser.parseAllRoutes();

    log(`\nFound ${routes.length} route files:\n`);
    for (const route of routes) {
      log(`  ${route.apiPath}`);
      for (const method of route.methods) {
        log(`    ${method.method.toUpperCase()} - auth: ${method.requiresAuth}`);
        if (method.requestSchema) log(`      request: ${method.requestSchema}`);
        if (method.querySchema) log(`      query: ${method.querySchema}`);
      }
    }
    log("");
  }

  // Generate spec
  const spec = generateAutoSpec(projectRoot);
  const jsonOutput = JSON.stringify(spec, null, 2);
  const yamlOutput = specToYaml(spec);

  log(`📝 Generated spec with ${Object.keys(spec.paths).length} paths`);

  // Output to stdout if requested
  if (options.stdout) {
    console.log(options.format === "yaml" ? yamlOutput : jsonOutput);
    return;
  }

  // Otherwise, update files in public/
  const publicDir = path.dirname(jsonPath);
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // Check if files need updating
  let jsonChanged = true;
  let yamlChanged = true;

  if (fs.existsSync(jsonPath)) {
    const existingJson = fs.readFileSync(jsonPath, "utf-8");
    jsonChanged = existingJson !== jsonOutput;
  }

  if (fs.existsSync(yamlPath)) {
    const existingYaml = fs.readFileSync(yamlPath, "utf-8");
    yamlChanged = existingYaml !== yamlOutput;
  }

  // Write files if changed
  if (jsonChanged) {
    fs.writeFileSync(jsonPath, jsonOutput);
    log("📄 Updated public/openapi.json");
  }

  if (yamlChanged) {
    fs.writeFileSync(yamlPath, yamlOutput);
    log("📄 Updated public/openapi.yaml");
  }

  if (!jsonChanged && !yamlChanged) {
    log("✅ OpenAPI specs are up to date");
  } else {
    log("✅ OpenAPI specs regenerated");
  }
}

main();
