import { allEndpoints, apiInfo, apiServers, apiTags } from "./endpoints";
import { generateOpenApiSpec } from "./generator";

// Legacy manual spec (for reference during migration)
export { openApiSpec as legacyOpenApiSpec } from "./spec";

/**
 * Generated OpenAPI spec from Effect Schema definitions
 * This is the new approach - schemas are automatically derived from the Effect Schemas
 * used for validation in the actual route handlers.
 */
export const openApiSpec = generateOpenApiSpec({
  info: apiInfo,
  servers: apiServers,
  tags: apiTags,
  endpoints: allEndpoints,
});

// Re-export types and utilities
export { allEndpoints, apiInfo, apiServers, apiTags } from "./endpoints";
export { type ApiEndpoint, type ApiTag, generateOpenApiSpec } from "./generator";

/**
 * Convert OpenAPI spec to YAML format
 */
export function specToYaml(spec: object): string {
  return toYaml(spec, 0);
}

function toYaml(value: unknown, indent: number): string {
  const spaces = "  ".repeat(indent);

  if (value === null || value === undefined) {
    return "null";
  }

  if (typeof value === "string") {
    // Check if string needs quoting
    if (
      value === "" ||
      value.includes(":") ||
      value.includes("#") ||
      value.includes("\n") ||
      value.includes('"') ||
      value.includes("'") ||
      value.startsWith(" ") ||
      value.endsWith(" ") ||
      value === "true" ||
      value === "false" ||
      value === "null" ||
      /^[\d.]+$/.test(value) ||
      value.includes("{") ||
      value.includes("}") ||
      value.includes("[") ||
      value.includes("]")
    ) {
      // Use double quotes and escape special characters
      const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
      return `"${escaped}"`;
    }
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }
    const lines = value.map((item) => {
      const itemYaml = toYaml(item, indent + 1);
      if (typeof item === "object" && item !== null && !Array.isArray(item)) {
        // Object items get their first key on the same line as the dash
        const firstLine = itemYaml.split("\n")[0];
        const restLines = itemYaml.split("\n").slice(1);
        if (restLines.length > 0) {
          return `${spaces}- ${firstLine}\n${restLines.join("\n")}`;
        }
        return `${spaces}- ${firstLine}`;
      }
      return `${spaces}- ${itemYaml}`;
    });
    return `\n${lines.join("\n")}`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return "{}";
    }
    const lines = entries.map(([key, val]) => {
      const valYaml = toYaml(val, indent + 1);
      // Check if key needs quoting
      const quotedKey =
        key.includes(":") || key.includes("#") || key.includes(" ") || key.startsWith("$") ? `"${key}"` : key;
      if (typeof val === "object" && val !== null && (Array.isArray(val) || Object.keys(val).length > 0)) {
        return `${spaces}${quotedKey}:${valYaml}`;
      }
      return `${spaces}${quotedKey}: ${valYaml}`;
    });
    if (indent === 0) {
      return lines.join("\n");
    }
    return `\n${lines.join("\n")}`;
  }

  return String(value);
}
