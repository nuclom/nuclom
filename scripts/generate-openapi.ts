#!/usr/bin/env npx tsx

/**
 * OpenAPI Spec Generator
 *
 * Generates OpenAPI 3.1 spec by parsing route.ts files and extracting:
 * - Request schemas from validateRequestBody/validateQueryParams calls
 * - Response schemas from JSDoc @response annotations
 * - Descriptions from JSDoc @summary and @description annotations
 *
 * Usage:
 *   pnpm openapi [options]
 *
 * Options:
 *   --stdout        Output to stdout instead of files
 *   --format, -f    Output format: json or yaml (default: json)
 *   --verbose       Print detailed parsing info
 *
 * JSDoc Format in route files:
 *   /**
 *    * @summary List videos
 *    * @description Get a paginated list of videos for an organization
 *    * @response 200 PaginatedVideos - List of videos
 *    * @response 401 - Unauthorized
 *    *\/
 *   export async function GET(request: NextRequest) { ... }
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { JSONSchema, Schema } from 'effect';
import { type FunctionDeclaration, Project, type SourceFile } from 'ts-morph';
import * as ResponseSchemas from '../src/lib/api/response-schemas';
// Auto-import all schemas
import * as RequestSchemas from '../src/lib/validation/schemas';

// =============================================================================
// Types
// =============================================================================

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

interface ParsedJsDoc {
  summary?: string;
  description?: string;
  responses: Array<{ status: string; schema?: string; description: string }>;
}

interface ParsedRoute {
  filePath: string;
  apiPath: string;
  methods: ParsedMethod[];
}

interface ParsedMethod {
  method: HttpMethod;
  requiresAuth: boolean;
  requestSchema?: string;
  querySchema?: string;
  pathParams: string[];
  jsDoc: ParsedJsDoc;
}

interface ApiParameter {
  name: string;
  in: 'query' | 'path' | 'header';
  description?: string;
  required?: boolean;
  schema: Schema.Schema.Any;
}

interface ApiEndpoint {
  path: string;
  method: HttpMethod;
  operationId: string;
  summary: string;
  description?: string;
  tags: string[];
  security?: boolean;
  parameters?: ApiParameter[];
  requestBody?: {
    description?: string;
    required?: boolean;
    schema: Schema.Schema.Any;
    contentType?: 'application/json' | 'multipart/form-data';
  };
  responses: {
    [statusCode: string]: {
      description: string;
      schema?: Schema.Schema.Any;
    };
  };
}

interface OpenApiSpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
    contact?: { name?: string; url?: string; email?: string };
    license?: { name: string; url?: string };
  };
  servers: Array<{ url: string; description?: string }>;
  tags: Array<{ name: string; description: string }>;
  paths: Record<string, unknown>;
  components: {
    schemas: Record<string, unknown>;
    parameters: Record<string, unknown>;
    responses: Record<string, unknown>;
    securitySchemes: Record<string, unknown>;
  };
}

// =============================================================================
// Schema Registry - Auto-populated from imports
// =============================================================================

const schemaRegistry: Record<string, Schema.Schema.Any> = {
  // Request schemas (from @/lib/validation/schemas)
  ...Object.fromEntries(
    Object.entries(RequestSchemas).filter(([name, value]) => name.endsWith('Schema') && Schema.isSchema(value)),
  ),
  // Response schemas (from @/lib/api/response-schemas)
  ...Object.fromEntries(Object.entries(ResponseSchemas).filter(([_, value]) => Schema.isSchema(value))),
} as Record<string, Schema.Schema.Any>;

// =============================================================================
// API Configuration
// =============================================================================

const apiInfo = {
  title: 'Nuclom API',
  version: '1.0.0',
  description:
    'Nuclom is a video collaboration platform that helps teams organize, share, and collaborate on video content.',
  contact: { name: 'Nuclom Support', url: 'https://nuclom.com/support' },
  license: { name: 'Elastic License 2.0', url: 'https://www.elastic.co/licensing/elastic-license' },
};

const apiServers = [{ url: 'https://nuclom.com/api', description: 'Production server' }];

const apiTags = [
  { name: 'Videos', description: 'Video management endpoints' },
  { name: 'Series', description: 'Video series/playlist management' },
  { name: 'Channels', description: 'Channel management' },
  { name: 'Organizations', description: 'Organization and team management' },
  { name: 'Comments', description: 'Video comments and discussions' },
  { name: 'Search', description: 'Search functionality' },
  { name: 'Notifications', description: 'User notifications' },
  { name: 'Billing', description: 'Subscription and billing management' },
  { name: 'AI', description: 'AI-powered video analysis' },
  { name: 'Integrations', description: 'Third-party integrations' },
  { name: 'Health', description: 'System health endpoints' },
  { name: 'Users', description: 'User management' },
  { name: 'Sharing', description: 'Content sharing' },
  { name: 'Clips', description: 'Video clips and highlights' },
];

const skipRoutes = [
  '/auth/{...auth}',
  '/webhooks/stripe',
  '/integrations/google/callback',
  '/integrations/zoom/callback',
];

// =============================================================================
// Route Parser
// =============================================================================

class RouteParser {
  private project: Project;
  private apiDir: string;
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.apiDir = path.join(projectRoot, 'src/app/api');
    this.project = new Project({
      tsConfigFilePath: path.join(projectRoot, 'tsconfig.json'),
      skipAddingFilesFromTsConfig: true,
    });
  }

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

  private findRouteFiles(): string[] {
    const files: string[] = [];
    const walkDir = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walkDir(fullPath);
        } else if (entry.name === 'route.ts') {
          files.push(fullPath);
        }
      }
    };
    walkDir(this.apiDir);
    return files;
  }

  private parseRouteFile(filePath: string): ParsedRoute | null {
    const sourceFile = this.project.addSourceFileAtPath(filePath);
    const apiPath = this.filePathToApiPath(filePath);
    const pathParams = this.extractPathParams(apiPath);
    const methods: ParsedMethod[] = [];
    const httpMethods: HttpMethod[] = ['get', 'post', 'put', 'patch', 'delete'];

    for (const method of httpMethods) {
      const methodUpper = method.toUpperCase();
      const funcDecl = sourceFile.getFunction(methodUpper);
      if (funcDecl?.isExported()) {
        const parsedMethod = this.parseMethod(sourceFile, funcDecl, method, pathParams);
        methods.push(parsedMethod);
      }
    }

    this.project.removeSourceFile(sourceFile);

    if (methods.length === 0) return null;
    return { filePath: path.relative(this.projectRoot, filePath), apiPath, methods };
  }

  private parseMethod(
    _sourceFile: SourceFile,
    funcDecl: FunctionDeclaration,
    method: HttpMethod,
    pathParams: string[],
  ): ParsedMethod {
    const funcBody = funcDecl.getBody()?.getText() ?? '';
    const requiresAuth = this.detectAuthUsage(funcBody);
    const requestSchema = this.extractRequestSchema(funcBody);
    const querySchema = this.extractQuerySchema(funcBody);
    const jsDoc = this.parseJsDoc(funcDecl);

    return { method, requiresAuth, requestSchema, querySchema, pathParams, jsDoc };
  }

  private parseJsDoc(funcDecl: FunctionDeclaration): ParsedJsDoc {
    const result: ParsedJsDoc = { responses: [] };

    // Get JSDoc comments
    const jsDocs = funcDecl.getJsDocs();
    if (jsDocs.length === 0) {
      // Fall back to leading comments
      const leadingComments = funcDecl.getLeadingCommentRanges();
      for (const comment of leadingComments) {
        const text = comment.getText();
        // Parse "// GET /api/videos - Description" style comments
        const match = text.match(/\/\/\s*(?:GET|POST|PUT|PATCH|DELETE)\s+[^\s]+\s+-\s+(.+)/);
        if (match) {
          result.summary = match[1].trim();
        }
      }
      return result;
    }

    for (const jsDoc of jsDocs) {
      // Get description from JSDoc body
      const description = jsDoc.getDescription()?.trim();
      if (description && !result.description) {
        result.description = description;
      }

      // Parse tags
      for (const tag of jsDoc.getTags()) {
        const tagName = tag.getTagName();
        const tagText = tag.getCommentText()?.trim() ?? '';

        switch (tagName) {
          case 'summary':
            result.summary = tagText;
            break;
          case 'description':
            result.description = tagText;
            break;
          case 'response': {
            // Parse "@response 200 SchemaName - Description" or "@response 401 - Description"
            const responseMatch = tagText.match(/^(\d{3})\s+(?:(\w+)\s+-\s+)?(.+)$/);
            if (responseMatch) {
              result.responses.push({
                status: responseMatch[1],
                schema: responseMatch[2],
                description: responseMatch[3],
              });
            }
            break;
          }
        }
      }
    }

    return result;
  }

  private filePathToApiPath(filePath: string): string {
    let relativePath = path.relative(this.apiDir, filePath);
    relativePath = path.dirname(relativePath);
    if (relativePath === '.') return '/';
    let apiPath = `/${relativePath.replace(/\[([^\]]+)\]/g, '{$1}')}`;
    apiPath = apiPath.replace(/\\/g, '/');
    if (apiPath.includes('{...')) return '';
    return apiPath;
  }

  private extractPathParams(apiPath: string): string[] {
    const matches = apiPath.match(/\{([^}]+)\}/g) ?? [];
    return matches.map((m) => m.slice(1, -1));
  }

  private detectAuthUsage(funcBody: string): boolean {
    return (
      funcBody.includes('yield* Auth') ||
      funcBody.includes('authService.getSession') ||
      funcBody.includes('getSession(request') ||
      funcBody.includes('auth()')
    );
  }

  private extractRequestSchema(funcBody: string): string | undefined {
    const match = funcBody.match(/validateRequestBody\s*\(\s*(\w+)/);
    if (match) return match[1];
    const effectMatch = funcBody.match(/Schema\.decodeUnknown\s*\(\s*(\w+)\)/);
    if (effectMatch) return effectMatch[1];
    return undefined;
  }

  private extractQuerySchema(funcBody: string): string | undefined {
    const match = funcBody.match(/validateQueryParams\s*\(\s*(\w+)/);
    return match?.[1];
  }
}

// =============================================================================
// OpenAPI Generator
// =============================================================================

function schemaToJsonSchema(schema: Schema.Schema.Any): Record<string, unknown> {
  try {
    const jsonSchema = JSONSchema.make(schema);
    const { $schema, ...rest } = jsonSchema as unknown as Record<string, unknown>;
    return rest;
  } catch {
    return { type: 'object' };
  }
}

function resolveSchema(schemaName: string): Schema.Schema.Any | undefined {
  return schemaRegistry[schemaName];
}

function capitalizeFirst(str: string): string {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
}

function singularize(str: string): string {
  if (str.endsWith('ies')) return `${str.slice(0, -3)}y`;
  if (str.endsWith('es') && !str.endsWith('ses')) return str.slice(0, -2);
  if (str.endsWith('s') && !str.endsWith('ss')) return str.slice(0, -1);
  return str;
}

function generateOperationId(path: string, method: HttpMethod): string {
  const parts = path.slice(1).split('/').filter(Boolean);
  const methodVerbs: Record<HttpMethod, string> = {
    get: 'get',
    post: 'create',
    put: 'update',
    patch: 'patch',
    delete: 'delete',
  };
  const verb = methodVerbs[method];
  const pathParts = parts
    .map((part) => (part.startsWith('{') && part.endsWith('}') ? '' : capitalizeFirst(singularize(part))))
    .filter(Boolean);
  if (pathParts.length === 0) return verb;
  if (method === 'get' && !path.includes('{')) return `list${pathParts.join('')}`;
  return verb + pathParts.join('');
}

function generateDefaultSummary(path: string, method: HttpMethod): string {
  const parts = path.slice(1).split('/').filter(Boolean);
  const methodLabels: Record<HttpMethod, string> = {
    get: 'Get',
    post: 'Create',
    put: 'Update',
    patch: 'Patch',
    delete: 'Delete',
  };
  const label = methodLabels[method];
  const resourceParts = parts.filter((p) => !p.startsWith('{'));
  const resource = resourceParts.length > 0 ? resourceParts[resourceParts.length - 1] : 'resource';
  if (method === 'get' && !path.includes('{')) return `List ${resource}`;
  return `${label} ${singularize(resource)}`;
}

function inferTagsFromPath(path: string): string[] {
  const parts = path.slice(1).split('/').filter(Boolean);
  if (parts.length === 0) return ['General'];
  const tagMappings: Record<string, string> = {
    videos: 'Videos',
    series: 'Series',
    organizations: 'Organizations',
    notifications: 'Notifications',
    billing: 'Billing',
    ai: 'AI',
    integrations: 'Integrations',
    health: 'Health',
    comments: 'Comments',
    channels: 'Channels',
    search: 'Search',
    users: 'Users',
    share: 'Sharing',
    clips: 'Clips',
    'highlight-reels': 'Clips',
    'quote-cards': 'Clips',
  };
  return [tagMappings[parts[0]] ?? capitalizeFirst(parts[0])];
}

function generateDefaultResponses(method: ParsedMethod): ApiEndpoint['responses'] {
  const responses: ApiEndpoint['responses'] = {};
  const successStatus = method.method === 'post' ? '201' : '200';
  responses[successStatus] = { description: method.method === 'post' ? 'Created successfully' : 'Success' };
  if (method.requiresAuth) responses['401'] = { description: 'Unauthorized' };
  if (method.requestSchema || method.querySchema) responses['400'] = { description: 'Invalid request' };
  if (method.pathParams.length > 0) responses['404'] = { description: 'Not found' };
  return responses;
}

function generateEndpointsFromRoutes(routes: ParsedRoute[]): ApiEndpoint[] {
  const endpoints: ApiEndpoint[] = [];

  for (const route of routes) {
    if (!route.apiPath || skipRoutes.includes(route.apiPath)) continue;

    for (const method of route.methods) {
      const operationId = generateOperationId(route.apiPath, method.method);
      const tags = inferTagsFromPath(route.apiPath);

      // Build responses from JSDoc or defaults
      let responses: ApiEndpoint['responses'];
      if (method.jsDoc.responses.length > 0) {
        responses = {};
        for (const r of method.jsDoc.responses) {
          responses[r.status] = {
            description: r.description,
            schema: r.schema ? resolveSchema(r.schema) : undefined,
          };
        }
      } else {
        responses = generateDefaultResponses(method);
      }

      const endpoint: ApiEndpoint = {
        path: route.apiPath,
        method: method.method,
        operationId,
        summary: method.jsDoc.summary ?? generateDefaultSummary(route.apiPath, method.method),
        description: method.jsDoc.description,
        tags,
        security: method.requiresAuth,
        responses,
      };

      // Path parameters
      if (method.pathParams.length > 0) {
        endpoint.parameters = method.pathParams.map((param) => ({
          name: param,
          in: 'path' as const,
          required: true,
          schema: Schema.UUID,
          description: `${capitalizeFirst(param)} ID`,
        }));
      }

      // Request body
      if (method.requestSchema) {
        const requestSchemaObj = resolveSchema(method.requestSchema);
        if (requestSchemaObj) {
          endpoint.requestBody = {
            description: `${endpoint.summary} data`,
            schema: requestSchemaObj,
          };
        }
      }

      endpoints.push(endpoint);
    }
  }

  endpoints.sort((a, b) => {
    const pathCompare = a.path.localeCompare(b.path);
    return pathCompare !== 0 ? pathCompare : a.method.localeCompare(b.method);
  });

  return endpoints;
}

function generateOpenApiSpec(endpoints: ApiEndpoint[]): OpenApiSpec {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const endpoint of endpoints) {
    const pathKey = endpoint.path.startsWith('/') ? endpoint.path : `/${endpoint.path}`;
    if (!paths[pathKey]) paths[pathKey] = {};

    const operation: Record<string, unknown> = {
      tags: endpoint.tags,
      summary: endpoint.summary,
      operationId: endpoint.operationId,
    };

    if (endpoint.description) operation.description = endpoint.description;
    if (endpoint.security) operation.security = [{ bearerAuth: [] }];

    if (endpoint.parameters && endpoint.parameters.length > 0) {
      operation.parameters = endpoint.parameters.map((param) => ({
        name: param.name,
        in: param.in,
        description: param.description,
        required: param.required ?? param.in === 'path',
        schema: schemaToJsonSchema(param.schema),
      }));
    }

    if (endpoint.requestBody) {
      const contentType = endpoint.requestBody.contentType ?? 'application/json';
      operation.requestBody = {
        required: endpoint.requestBody.required ?? true,
        description: endpoint.requestBody.description,
        content: { [contentType]: { schema: schemaToJsonSchema(endpoint.requestBody.schema) } },
      };
    }

    const responses: Record<string, unknown> = {};
    for (const [statusCode, response] of Object.entries(endpoint.responses)) {
      const responseObj: Record<string, unknown> = { description: response.description };
      if (response.schema) {
        responseObj.content = { 'application/json': { schema: schemaToJsonSchema(response.schema) } };
      }
      responses[statusCode] = responseObj;
    }
    operation.responses = responses;

    paths[pathKey][endpoint.method] = operation;
  }

  return {
    openapi: '3.1.0',
    info: apiInfo,
    servers: apiServers,
    tags: apiTags,
    paths,
    components: {
      schemas: {},
      parameters: {
        organizationId: {
          name: 'organizationId',
          in: 'query',
          description: 'Organization ID to scope the request',
          required: true,
          schema: { type: 'string', format: 'uuid' },
        },
        page: {
          name: 'page',
          in: 'query',
          description: 'Page number for pagination',
          required: false,
          schema: { type: 'integer', minimum: 1, default: 1 },
        },
        limit: {
          name: 'limit',
          in: 'query',
          description: 'Number of items per page',
          required: false,
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
      },
      responses: {
        BadRequest: {
          description: 'Invalid request parameters',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { error: { type: 'string' }, code: { type: 'string' }, details: { type: 'object' } },
                required: ['error', 'code'],
              },
            },
          },
        },
        Unauthorized: {
          description: 'Missing or invalid authentication',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Unauthorized' },
                  code: { type: 'string', example: 'AUTH_REQUIRED' },
                },
                required: ['error', 'code'],
              },
            },
          },
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  error: { type: 'string', example: 'Not found' },
                  code: { type: 'string', example: 'NOT_FOUND' },
                },
                required: ['error', 'code'],
              },
            },
          },
        },
      },
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Authentication token from login or API key',
        },
      },
    },
  };
}

// =============================================================================
// YAML Conversion
// =============================================================================

function toYaml(value: unknown, indent: number): string {
  const spaces = '  '.repeat(indent);

  if (value === null || value === undefined) return 'null';

  if (typeof value === 'string') {
    if (
      value === '' ||
      value.includes(':') ||
      value.includes('#') ||
      value.includes('\n') ||
      value.includes('"') ||
      value.includes("'") ||
      value.startsWith(' ') ||
      value.endsWith(' ') ||
      value === 'true' ||
      value === 'false' ||
      value === 'null' ||
      /^[\d.]+$/.test(value) ||
      value.includes('{') ||
      value.includes('}') ||
      value.includes('[') ||
      value.includes(']')
    ) {
      const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
      return `"${escaped}"`;
    }
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') return String(value);

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const lines = value.map((item) => {
      const itemYaml = toYaml(item, indent + 1);
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        const firstLine = itemYaml.split('\n')[0];
        const restLines = itemYaml.split('\n').slice(1);
        if (restLines.length > 0) return `${spaces}- ${firstLine}\n${restLines.join('\n')}`;
        return `${spaces}- ${firstLine}`;
      }
      return `${spaces}- ${itemYaml}`;
    });
    return `\n${lines.join('\n')}`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    const lines = entries.map(([key, val]) => {
      const valYaml = toYaml(val, indent + 1);
      const quotedKey =
        key.includes(':') || key.includes('#') || key.includes(' ') || key.startsWith('$') ? `"${key}"` : key;
      if (typeof val === 'object' && val !== null && (Array.isArray(val) || Object.keys(val).length > 0)) {
        return `${spaces}${quotedKey}:${valYaml}`;
      }
      return `${spaces}${quotedKey}: ${valYaml}`;
    });
    if (indent === 0) return lines.join('\n');
    return `\n${lines.join('\n')}`;
  }

  return String(value);
}

// =============================================================================
// CLI
// =============================================================================

function parseArgs() {
  const args = process.argv.slice(2);
  const options = { stdout: false, format: 'json' as 'json' | 'yaml', verbose: false };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--stdout':
        options.stdout = true;
        break;
      case '--format':
      case '-f':
        options.format = args[++i] as 'json' | 'yaml';
        break;
      case '--verbose':
        options.verbose = true;
        break;
    }
  }

  return options;
}

function main() {
  const options = parseArgs();
  const projectRoot = path.resolve(import.meta.dirname, '..');
  const jsonPath = path.join(projectRoot, 'public', 'openapi.json');
  const yamlPath = path.join(projectRoot, 'public', 'openapi.yaml');

  const log = options.stdout ? console.error : console.log;

  log('Parsing route files...');
  log(`Loaded ${Object.keys(schemaRegistry).length} schemas from registry`);

  const parser = new RouteParser(projectRoot);
  const routes = parser.parseAllRoutes();

  if (options.verbose) {
    log(`\nFound ${routes.length} route files:\n`);
    for (const route of routes) {
      log(`  ${route.apiPath}`);
      for (const method of route.methods) {
        log(`    ${method.method.toUpperCase()} - auth: ${method.requiresAuth}`);
        if (method.requestSchema) log(`      request: ${method.requestSchema}`);
        if (method.querySchema) log(`      query: ${method.querySchema}`);
        if (method.jsDoc.summary) log(`      summary: ${method.jsDoc.summary}`);
        if (method.jsDoc.responses.length > 0) {
          log(`      responses: ${method.jsDoc.responses.map((r) => `${r.status}:${r.schema ?? 'none'}`).join(', ')}`);
        }
      }
    }
    log('');
  }

  const endpoints = generateEndpointsFromRoutes(routes);
  const spec = generateOpenApiSpec(endpoints);
  const jsonOutput = JSON.stringify(spec, null, 2);
  const yamlOutput = toYaml(spec, 0);

  log(`Generated spec with ${Object.keys(spec.paths).length} paths`);

  if (options.stdout) {
    console.log(options.format === 'yaml' ? yamlOutput : jsonOutput);
    return;
  }

  const publicDir = path.dirname(jsonPath);
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

  let jsonChanged = true;
  let yamlChanged = true;

  if (fs.existsSync(jsonPath)) {
    jsonChanged = fs.readFileSync(jsonPath, 'utf-8') !== jsonOutput;
  }
  if (fs.existsSync(yamlPath)) {
    yamlChanged = fs.readFileSync(yamlPath, 'utf-8') !== yamlOutput;
  }

  if (jsonChanged) {
    fs.writeFileSync(jsonPath, jsonOutput);
    log('Updated public/openapi.json');
  }
  if (yamlChanged) {
    fs.writeFileSync(yamlPath, yamlOutput);
    log('Updated public/openapi.yaml');
  }

  if (!jsonChanged && !yamlChanged) {
    log('OpenAPI specs are up to date');
  } else {
    log('OpenAPI specs regenerated');
  }
}

main();
