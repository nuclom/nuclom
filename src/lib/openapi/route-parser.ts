/**
 * Route Parser - Automatically extracts OpenAPI endpoint info from Next.js route files
 *
 * Parses route.ts files to extract:
 * - HTTP methods (GET, POST, PUT, PATCH, DELETE)
 * - Route path (from file system path)
 * - Request/query schemas (from validateRequestBody/validateQueryParams calls)
 * - Authentication requirements (from Auth service usage)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { Schema } from "effect";
import { Project, type SourceFile } from "ts-morph";
import type { ApiEndpoint, HttpMethod } from "./generator";

// =============================================================================
// Types
// =============================================================================

export interface ParsedRoute {
  /** File path relative to project root */
  filePath: string;
  /** API path (e.g., /videos/{id}) */
  apiPath: string;
  /** HTTP methods defined in this route */
  methods: ParsedMethod[];
}

export interface ParsedMethod {
  /** HTTP method */
  method: HttpMethod;
  /** Whether authentication is required (uses Auth service) */
  requiresAuth: boolean;
  /** Request body schema name (if any) */
  requestSchema?: string;
  /** Query params schema name (if any) */
  querySchema?: string;
  /** Path parameters extracted from the route */
  pathParams: string[];
  /** Description from JSDoc comment */
  description?: string;
}

export interface RouteParserOptions {
  /** Root directory of the project */
  projectRoot: string;
  /** Path to the api directory (relative to project root) */
  apiDir?: string;
  /** Path to tsconfig.json */
  tsconfigPath?: string;
}

// =============================================================================
// Route Parser
// =============================================================================

export class RouteParser {
  private project: Project;
  private apiDir: string;
  private projectRoot: string;

  constructor(options: RouteParserOptions) {
    this.projectRoot = options.projectRoot;
    this.apiDir = path.join(options.projectRoot, options.apiDir ?? "src/app/api");

    this.project = new Project({
      tsConfigFilePath: options.tsconfigPath ?? path.join(options.projectRoot, "tsconfig.json"),
      skipAddingFilesFromTsConfig: true,
    });
  }

  /**
   * Parse all route files in the API directory
   */
  parseAllRoutes(): ParsedRoute[] {
    const routeFiles = this.findRouteFiles();
    const routes: ParsedRoute[] = [];

    for (const filePath of routeFiles) {
      try {
        const route = this.parseRouteFile(filePath);
        if (route && route.methods.length > 0) {
          routes.push(route);
        }
      } catch (error) {
        console.warn(`Failed to parse route file: ${filePath}`, error);
      }
    }

    return routes;
  }

  /**
   * Find all route.ts files in the API directory
   */
  private findRouteFiles(): string[] {
    const files: string[] = [];

    const walkDir = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walkDir(fullPath);
        } else if (entry.name === "route.ts") {
          files.push(fullPath);
        }
      }
    };

    walkDir(this.apiDir);
    return files;
  }

  /**
   * Parse a single route file
   */
  private parseRouteFile(filePath: string): ParsedRoute | null {
    const sourceFile = this.project.addSourceFileAtPath(filePath);
    const apiPath = this.filePathToApiPath(filePath);
    const pathParams = this.extractPathParams(apiPath);

    const methods: ParsedMethod[] = [];

    // Find exported HTTP method functions
    const httpMethods: HttpMethod[] = ["get", "post", "put", "patch", "delete"];

    for (const method of httpMethods) {
      const methodUpper = method.toUpperCase();
      const funcDecl = sourceFile.getFunction(methodUpper);

      if (funcDecl?.isExported()) {
        const parsedMethod = this.parseMethod(sourceFile, funcDecl, method, pathParams);
        methods.push(parsedMethod);
      }
    }

    // Clean up to avoid memory issues
    this.project.removeSourceFile(sourceFile);

    if (methods.length === 0) {
      return null;
    }

    return {
      filePath: path.relative(this.projectRoot, filePath),
      apiPath,
      methods,
    };
  }

  /**
   * Parse a single HTTP method function
   */
  private parseMethod(
    sourceFile: SourceFile,
    // biome-ignore lint/suspicious/noExplicitAny: ts-morph function type is complex
    funcDecl: any,
    method: HttpMethod,
    pathParams: string[],
  ): ParsedMethod {
    const funcBody = funcDecl.getBody()?.getText() ?? "";
    const _fullText = funcDecl.getText();

    // Check for Auth service usage
    const requiresAuth = this.detectAuthUsage(funcBody);

    // Extract schema names from validation calls
    const requestSchema = this.extractRequestSchema(sourceFile, funcBody);
    const querySchema = this.extractQuerySchema(sourceFile, funcBody);

    // Extract description from JSDoc or comments
    const description = this.extractDescription(funcDecl);

    return {
      method,
      requiresAuth,
      requestSchema,
      querySchema,
      pathParams,
      description,
    };
  }

  /**
   * Convert file path to API path
   * e.g., src/app/api/videos/[id]/comments/route.ts -> /videos/{id}/comments
   */
  private filePathToApiPath(filePath: string): string {
    // Get relative path from api directory
    let relativePath = path.relative(this.apiDir, filePath);

    // Remove route.ts
    relativePath = path.dirname(relativePath);

    // Handle root route
    if (relativePath === ".") {
      return "/";
    }

    // Convert [param] to {param} for OpenAPI
    let apiPath = `/${relativePath.replace(/\[([^\]]+)\]/g, "{$1}")}`;

    // Normalize path separators
    apiPath = apiPath.replace(/\\/g, "/");

    // Handle catch-all routes [...param] -> skip these
    if (apiPath.includes("{...")) {
      return "";
    }

    return apiPath;
  }

  /**
   * Extract path parameters from API path
   */
  private extractPathParams(apiPath: string): string[] {
    const matches = apiPath.match(/\{([^}]+)\}/g) ?? [];
    return matches.map((m) => m.slice(1, -1));
  }

  /**
   * Detect if the function uses the Auth service
   */
  private detectAuthUsage(funcBody: string): boolean {
    // Check for common auth patterns
    return (
      funcBody.includes("yield* Auth") ||
      funcBody.includes("authService.getSession") ||
      funcBody.includes("getSession(request") ||
      funcBody.includes("auth()")
    );
  }

  /**
   * Extract request body schema name from validateRequestBody calls
   */
  private extractRequestSchema(_sourceFile: SourceFile, funcBody: string): string | undefined {
    // Look for validateRequestBody(schemaName, request) pattern
    const match = funcBody.match(/validateRequestBody\s*\(\s*(\w+)/);
    if (match) {
      return match[1];
    }

    // Also check for direct schema validation patterns
    const effectMatch = funcBody.match(/Schema\.decodeUnknown\s*\(\s*(\w+)\)/);
    if (effectMatch) {
      return effectMatch[1];
    }

    return undefined;
  }

  /**
   * Extract query params schema name from validateQueryParams calls
   */
  private extractQuerySchema(_sourceFile: SourceFile, funcBody: string): string | undefined {
    // Look for validateQueryParams(schemaName, url) pattern
    const match = funcBody.match(/validateQueryParams\s*\(\s*(\w+)/);
    if (match) {
      return match[1];
    }

    return undefined;
  }

  /**
   * Extract description from JSDoc comment or inline comments
   */
  // biome-ignore lint/suspicious/noExplicitAny: ts-morph node type is complex
  private extractDescription(funcDecl: any): string | undefined {
    // Try to get JSDoc
    const jsDocs = funcDecl.getJsDocs?.() ?? [];
    if (jsDocs.length > 0) {
      return jsDocs[0].getDescription?.()?.trim();
    }

    // Try to get leading comment
    const leadingComments = funcDecl.getLeadingCommentRanges?.() ?? [];
    for (const comment of leadingComments) {
      const text = comment.getText();
      // Look for description in comment block
      const match = text.match(/\/\/\s*=+\s*\n\/\/\s*(.+?)\s*\n/);
      if (match) {
        return match[1];
      }
      // Simple single-line comment
      if (text.startsWith("//") && !text.includes("===")) {
        return text.replace(/^\/\/\s*/, "").trim();
      }
    }

    return undefined;
  }
}

// =============================================================================
// Schema Resolver
// =============================================================================

/**
 * Resolves schema names to actual Effect Schema objects
 */
export class SchemaResolver {
  private schemaCache: Map<string, unknown> = new Map();
  private validationSchemas: Record<string, unknown> = {};
  private responseSchemas: Record<string, unknown> = {};

  constructor(validationSchemas: Record<string, unknown>, responseSchemas: Record<string, unknown>) {
    this.validationSchemas = validationSchemas;
    this.responseSchemas = responseSchemas;
  }

  /**
   * Resolve a schema name to its Effect Schema object
   */
  resolveSchema(schemaName: string): unknown | undefined {
    // Check cache first
    if (this.schemaCache.has(schemaName)) {
      return this.schemaCache.get(schemaName);
    }

    // Try validation schemas
    if (schemaName in this.validationSchemas) {
      const schema = this.validationSchemas[schemaName];
      this.schemaCache.set(schemaName, schema);
      return schema;
    }

    // Try response schemas
    if (schemaName in this.responseSchemas) {
      const schema = this.responseSchemas[schemaName];
      this.schemaCache.set(schemaName, schema);
      return schema;
    }

    return undefined;
  }
}

// =============================================================================
// Endpoint Generator
// =============================================================================

/**
 * Configuration for endpoint generation
 */
export interface EndpointGeneratorConfig {
  /** Map of schema names to Effect Schema objects */
  validationSchemas: Record<string, unknown>;
  /** Map of response schema names to Effect Schema objects */
  responseSchemas: Record<string, unknown>;
  /** Map of route paths to tags */
  pathToTags?: Record<string, string[]>;
  /** Map of route paths to response schema overrides */
  responseOverrides?: Record<string, Record<string, unknown>>;
}

/**
 * Generate ApiEndpoint objects from parsed routes
 */
export function generateEndpointsFromRoutes(routes: ParsedRoute[], config: EndpointGeneratorConfig): ApiEndpoint[] {
  const endpoints: ApiEndpoint[] = [];
  const schemaResolver = new SchemaResolver(config.validationSchemas, config.responseSchemas);

  for (const route of routes) {
    // Skip empty paths (catch-all routes, etc.)
    if (!route.apiPath) {
      continue;
    }

    for (const method of route.methods) {
      const endpoint = createEndpoint(route, method, schemaResolver, config);
      if (endpoint) {
        endpoints.push(endpoint);
      }
    }
  }

  // Sort by path and method for consistent output
  endpoints.sort((a, b) => {
    const pathCompare = a.path.localeCompare(b.path);
    if (pathCompare !== 0) return pathCompare;
    return a.method.localeCompare(b.method);
  });

  return endpoints;
}

/**
 * Create a single endpoint from parsed route and method
 */
function createEndpoint(
  route: ParsedRoute,
  method: ParsedMethod,
  schemaResolver: SchemaResolver,
  config: EndpointGeneratorConfig,
): ApiEndpoint | null {
  const { apiPath } = route;

  // Generate operation ID from path and method
  const operationId = generateOperationId(apiPath, method.method);

  // Generate summary from path and method
  const summary = generateSummary(apiPath, method.method);

  // Determine tags from path
  const tags = config.pathToTags?.[apiPath] ?? inferTagsFromPath(apiPath);

  // Get responses - use overrides or generate defaults
  const responseOverride = config.responseOverrides?.[`${method.method.toUpperCase()} ${apiPath}`];
  const responses = responseOverride
    ? (responseOverride as ApiEndpoint["responses"])
    : generateDefaultResponses(method);

  // Build endpoint
  const endpoint: ApiEndpoint = {
    path: apiPath,
    method: method.method,
    operationId,
    summary,
    tags,
    security: method.requiresAuth,
    responses,
  };

  // Add description if available
  if (method.description) {
    endpoint.description = method.description;
  }

  // Add path parameters
  if (method.pathParams.length > 0) {
    endpoint.parameters = method.pathParams.map((param) => ({
      name: param,
      in: "path" as const,
      required: true,
      schema: Schema.UUID,
      description: `${capitalizeFirst(param)} ID`,
    }));
  }

  // Add query parameters from schema
  if (method.querySchema) {
    const querySchemaObj = schemaResolver.resolveSchema(method.querySchema);
    if (querySchemaObj && endpoint.parameters) {
      // Query params are handled via the schema, but we don't parse struct fields here
      // This would require more complex schema introspection
    }
  }

  // Add request body
  if (method.requestSchema) {
    const requestSchemaObj = schemaResolver.resolveSchema(method.requestSchema);
    if (requestSchemaObj) {
      endpoint.requestBody = {
        description: `${summary} data`,
        schema: requestSchemaObj as import("effect").Schema.Schema.Any,
      };
    }
  }

  return endpoint;
}

/**
 * Generate operation ID from path and method
 * e.g., GET /videos/{id} -> getVideo
 */
function generateOperationId(path: string, method: HttpMethod): string {
  // Remove leading slash and split by /
  const parts = path.slice(1).split("/").filter(Boolean);

  // Map of method to verb prefixes
  const methodVerbs: Record<HttpMethod, string> = {
    get: "get",
    post: "create",
    put: "update",
    patch: "patch",
    delete: "delete",
  };

  const verb = methodVerbs[method];

  // Build operation ID from path parts
  const pathParts = parts
    .map((part) => {
      if (part.startsWith("{") && part.endsWith("}")) {
        return ""; // Skip path params
      }
      return capitalizeFirst(singularize(part));
    })
    .filter(Boolean);

  // Handle special cases
  if (pathParts.length === 0) {
    return verb;
  }

  // For list operations (GET on collection)
  if (method === "get" && !path.includes("{")) {
    return `list${pathParts.join("")}`;
  }

  return verb + pathParts.join("");
}

/**
 * Generate summary from path and method
 */
function generateSummary(path: string, method: HttpMethod): string {
  const parts = path.slice(1).split("/").filter(Boolean);

  const methodLabels: Record<HttpMethod, string> = {
    get: "Get",
    post: "Create",
    put: "Update",
    patch: "Patch",
    delete: "Delete",
  };

  const label = methodLabels[method];

  // Get the resource name from path
  const resourceParts = parts.filter((p) => !p.startsWith("{"));
  const resource = resourceParts.length > 0 ? resourceParts[resourceParts.length - 1] : "resource";

  // For list operations
  if (method === "get" && !path.includes("{")) {
    return `List ${resource}`;
  }

  return `${label} ${singularize(resource)}`;
}

/**
 * Infer tags from path
 */
function inferTagsFromPath(path: string): string[] {
  const parts = path.slice(1).split("/").filter(Boolean);

  if (parts.length === 0) {
    return ["General"];
  }

  // Use first path segment as primary tag
  const primaryTag = capitalizeFirst(parts[0]);

  // Map known paths to better tag names
  const tagMappings: Record<string, string> = {
    videos: "Videos",
    series: "Series",
    organizations: "Organizations",
    notifications: "Notifications",
    billing: "Billing",
    ai: "AI",
    integrations: "Integrations",
    health: "Health",
    comments: "Comments",
    channels: "Channels",
    search: "Search",
    users: "Users",
    auth: "Authentication",
    oauth: "OAuth",
    webhooks: "Webhooks",
    share: "Sharing",
  };

  return [tagMappings[parts[0]] ?? primaryTag];
}

/**
 * Generate default responses for an endpoint
 */
function generateDefaultResponses(method: ParsedMethod): ApiEndpoint["responses"] {
  const responses: ApiEndpoint["responses"] = {};

  // Success response
  const successStatus = method.method === "post" ? "201" : "200";
  responses[successStatus] = {
    description: method.method === "post" ? "Created successfully" : "Success",
  };

  // Error responses
  if (method.requiresAuth) {
    responses["401"] = { description: "Unauthorized" };
  }

  if (method.requestSchema || method.querySchema) {
    responses["400"] = { description: "Invalid request" };
  }

  if (method.pathParams.length > 0) {
    responses["404"] = { description: "Not found" };
  }

  return responses;
}

// =============================================================================
// Utility Functions
// =============================================================================

function capitalizeFirst(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function singularize(str: string): string {
  // Simple singularization - covers common cases
  if (str.endsWith("ies")) {
    return `${str.slice(0, -3)}y`;
  }
  if (str.endsWith("es") && !str.endsWith("ses")) {
    return str.slice(0, -2);
  }
  if (str.endsWith("s") && !str.endsWith("ss")) {
    return str.slice(0, -1);
  }
  return str;
}
