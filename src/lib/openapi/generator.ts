/**
 * OpenAPI Spec Generator from Effect Schema
 *
 * Automatically generates OpenAPI 3.1 specification from declarative
 * endpoint definitions that reference Effect Schemas.
 */
import { JSONSchema, type Schema } from "effect";

// =============================================================================
// Types
// =============================================================================

export type HttpMethod = "get" | "post" | "put" | "patch" | "delete";

export interface ApiParameter {
  name: string;
  in: "query" | "path" | "header";
  description?: string;
  required?: boolean;
  schema: Schema.Schema.Any;
}

export interface ApiEndpoint {
  path: string;
  method: HttpMethod;
  operationId: string;
  summary: string;
  description?: string;
  tags: string[];
  security?: boolean; // true = requires bearerAuth
  parameters?: ApiParameter[];
  requestBody?: {
    description?: string;
    required?: boolean;
    schema: Schema.Schema.Any;
    contentType?: "application/json" | "multipart/form-data";
  };
  responses: {
    [statusCode: string]: {
      description: string;
      schema?: Schema.Schema.Any;
    };
  };
}

export interface ApiTag {
  name: string;
  description: string;
}

export interface ApiInfo {
  title: string;
  version: string;
  description?: string;
  contact?: {
    name?: string;
    url?: string;
    email?: string;
  };
  license?: {
    name: string;
    url?: string;
  };
}

export interface ApiServer {
  url: string;
  description?: string;
}

export interface OpenApiSpec {
  openapi: string;
  info: ApiInfo;
  servers: ApiServer[];
  tags: ApiTag[];
  paths: Record<string, unknown>;
  components: {
    schemas: Record<string, unknown>;
    parameters: Record<string, unknown>;
    responses: Record<string, unknown>;
    securitySchemes: Record<string, unknown>;
  };
}

// =============================================================================
// Schema Conversion
// =============================================================================

/**
 * Convert an Effect Schema to JSON Schema format for OpenAPI
 */
function schemaToJsonSchema(schema: Schema.Schema.Any): Record<string, unknown> {
  try {
    const jsonSchema = JSONSchema.make(schema);

    // Remove the $schema property as OpenAPI has its own schema identifier
    const { $schema, ...rest } = jsonSchema as unknown as Record<string, unknown>;

    return rest;
  } catch {
    // Fallback for schemas that can't be converted
    return { type: "object" };
  }
}

// =============================================================================
// Spec Generator
// =============================================================================

/**
 * Generate OpenAPI 3.1 spec from endpoint definitions
 */
export function generateOpenApiSpec(config: {
  info: ApiInfo;
  servers: ApiServer[];
  tags: ApiTag[];
  endpoints: ApiEndpoint[];
}): OpenApiSpec {
  const { info, servers, tags, endpoints } = config;

  const paths: Record<string, Record<string, unknown>> = {};
  const schemas: Record<string, unknown> = {};

  // Process each endpoint
  for (const endpoint of endpoints) {
    const pathKey = endpoint.path.startsWith("/") ? endpoint.path : `/${endpoint.path}`;

    if (!paths[pathKey]) {
      paths[pathKey] = {};
    }

    const operation: Record<string, unknown> = {
      tags: endpoint.tags,
      summary: endpoint.summary,
      operationId: endpoint.operationId,
    };

    if (endpoint.description) {
      operation.description = endpoint.description;
    }

    // Security
    if (endpoint.security) {
      operation.security = [{ bearerAuth: [] }];
    }

    // Parameters
    if (endpoint.parameters && endpoint.parameters.length > 0) {
      operation.parameters = endpoint.parameters.map((param) => ({
        name: param.name,
        in: param.in,
        description: param.description,
        required: param.required ?? param.in === "path",
        schema: schemaToJsonSchema(param.schema),
      }));
    }

    // Request Body
    if (endpoint.requestBody) {
      const contentType = endpoint.requestBody.contentType ?? "application/json";
      operation.requestBody = {
        required: endpoint.requestBody.required ?? true,
        description: endpoint.requestBody.description,
        content: {
          [contentType]: {
            schema: schemaToJsonSchema(endpoint.requestBody.schema),
          },
        },
      };
    }

    // Responses
    const responses: Record<string, unknown> = {};
    for (const [statusCode, response] of Object.entries(endpoint.responses)) {
      const responseObj: Record<string, unknown> = {
        description: response.description,
      };

      if (response.schema) {
        responseObj.content = {
          "application/json": {
            schema: schemaToJsonSchema(response.schema),
          },
        };
      }

      responses[statusCode] = responseObj;
    }
    operation.responses = responses;

    paths[pathKey][endpoint.method] = operation;
  }

  return {
    openapi: "3.1.0",
    info,
    servers,
    tags,
    paths,
    components: {
      schemas,
      parameters: buildCommonParameters(),
      responses: buildCommonResponses(),
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Authentication token from login or API key",
        },
      },
    },
  };
}

// =============================================================================
// Common Components
// =============================================================================

function buildCommonParameters(): Record<string, unknown> {
  return {
    organizationId: {
      name: "organizationId",
      in: "query",
      description: "Organization ID to scope the request",
      required: true,
      schema: { type: "string", format: "uuid" },
    },
    page: {
      name: "page",
      in: "query",
      description: "Page number for pagination",
      required: false,
      schema: { type: "integer", minimum: 1, default: 1 },
    },
    limit: {
      name: "limit",
      in: "query",
      description: "Number of items per page",
      required: false,
      schema: { type: "integer", minimum: 1, maximum: 100, default: 20 },
    },
  };
}

function buildCommonResponses(): Record<string, unknown> {
  return {
    BadRequest: {
      description: "Invalid request parameters",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              error: { type: "string" },
              code: { type: "string" },
              details: { type: "object" },
            },
            required: ["error", "code"],
          },
        },
      },
    },
    Unauthorized: {
      description: "Missing or invalid authentication",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              error: { type: "string", example: "Unauthorized" },
              code: { type: "string", example: "AUTH_REQUIRED" },
            },
            required: ["error", "code"],
          },
        },
      },
    },
    Forbidden: {
      description: "Insufficient permissions",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              error: { type: "string", example: "Permission denied" },
              code: { type: "string", example: "PERMISSION_DENIED" },
            },
            required: ["error", "code"],
          },
        },
      },
    },
    NotFound: {
      description: "Resource not found",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              error: { type: "string", example: "Not found" },
              code: { type: "string", example: "NOT_FOUND" },
            },
            required: ["error", "code"],
          },
        },
      },
    },
  };
}

// =============================================================================
// Helper for building references
// =============================================================================

export function ref(component: "schemas" | "parameters" | "responses", name: string): { $ref: string } {
  return { $ref: `#/components/${component}/${name}` };
}
