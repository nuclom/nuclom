#!/usr/bin/env npx tsx
/**
 * Update OpenAPI Spec
 *
 * Regenerates the OpenAPI spec files if they're out of date.
 * Used by the pre-commit hook to keep specs in sync.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { specToYaml } from "../src/lib/openapi";
import { generateAutoSpec } from "../src/lib/openapi/auto-endpoints";

const projectRoot = path.resolve(import.meta.dirname, "..");
const jsonPath = path.join(projectRoot, "public", "openapi.json");
const yamlPath = path.join(projectRoot, "public", "openapi.yaml");

function main() {
  console.log("🔍 Generating OpenAPI spec...");

  // Generate spec
  const spec = generateAutoSpec(projectRoot);

  // Generate outputs
  const jsonOutput = JSON.stringify(spec, null, 2);
  const yamlOutput = specToYaml(spec);

  // Ensure public directory exists
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
    console.log("📄 Updated public/openapi.json");
  }

  if (yamlChanged) {
    fs.writeFileSync(yamlPath, yamlOutput);
    console.log("📄 Updated public/openapi.yaml");
  }

  if (!jsonChanged && !yamlChanged) {
    console.log("✅ OpenAPI specs are up to date");
  } else {
    console.log("✅ OpenAPI specs regenerated");
    // Exit with code 0 - lefthook will stage the files
  }
}

main();
