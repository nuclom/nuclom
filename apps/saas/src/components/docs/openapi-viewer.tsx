'use client';

import { Check, ChevronDown, ChevronRight, Copy, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';

// The OpenAPI spec is generated at build time and served as a static file
type OpenApiSpec = {
  openapi: string;
  info: { title: string; description?: string; version: string };
  servers?: Array<{ url: string; description?: string }>;
  tags?: Array<{ name: string; description?: string }>;
  paths: Record<string, Record<string, PathOperation>>;
  components?: { parameters?: Record<string, ParameterDef> };
};

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';
type Tag = { name: string; description?: string };

// Parameter can be a reference or an inline definition
type ParameterDef = {
  name?: string;
  in?: string;
  required?: boolean;
  schema?: { type?: string; format?: string; default?: unknown };
  description?: string;
  $ref?: string;
};

type PathOperation = {
  tags?: string[];
  summary?: string;
  description?: string;
  operationId?: string;
  security?: Array<Record<string, unknown>>;
  parameters?: ParameterDef[];
  requestBody?: {
    required?: boolean;
    content?: Record<
      string,
      {
        schema?: { $ref?: string; type?: string; properties?: Record<string, unknown> };
      }
    >;
  };
  responses?: Record<
    string,
    {
      description?: string;
      content?: Record<string, { schema?: { $ref?: string; type?: string } }>;
      $ref?: string;
    }
  >;
};

const methodColors: Record<HttpMethod, string> = {
  get: 'bg-blue-500/10 text-blue-600 border-blue-200',
  post: 'bg-green-500/10 text-green-600 border-green-200',
  put: 'bg-yellow-500/10 text-yellow-600 border-yellow-200',
  patch: 'bg-orange-500/10 text-orange-600 border-orange-200',
  delete: 'bg-red-500/10 text-red-600 border-red-200',
};

const methodBadgeColors: Record<HttpMethod, string> = {
  get: 'bg-blue-500',
  post: 'bg-green-500',
  put: 'bg-yellow-500',
  patch: 'bg-orange-500',
  delete: 'bg-red-500',
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="p-1 hover:bg-muted rounded transition-colors"
      title="Copy to clipboard"
    >
      {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

function EndpointCard({
  path,
  method,
  operation,
  spec,
}: {
  path: string;
  method: HttpMethod;
  operation: PathOperation;
  spec: OpenApiSpec;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const requiresAuth = operation.security && operation.security.length > 0;

  // Resolve parameter references
  const resolveParamRef = (param: ParameterDef): ParameterDef => {
    if (param.$ref) {
      const refPath = param.$ref.replace('#/components/parameters/', '');
      const params = spec.components?.parameters;
      return params?.[refPath] || param;
    }
    return param;
  };

  const parameters = operation.parameters?.map(resolveParamRef) || [];

  return (
    <div className={`border rounded-lg overflow-hidden mb-4 ${methodColors[method]}`}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-black/5 transition-colors"
      >
        <span className={`px-2 py-1 rounded text-xs font-bold uppercase text-white ${methodBadgeColors[method]}`}>
          {method}
        </span>
        <code className="text-sm font-mono flex-1 text-left">{path}</code>
        {requiresAuth && (
          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded">Auth Required</span>
        )}
        <span className="text-muted-foreground text-sm truncate max-w-xs">{operation.summary}</span>
        {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
      </button>

      {isExpanded && (
        <div className="px-4 py-4 border-t bg-background/50 space-y-4">
          {operation.description && <p className="text-sm text-muted-foreground">{operation.description}</p>}

          {parameters.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm mb-2">Parameters</h4>
              <div className="space-y-2">
                {parameters.map((p) => (
                  <div
                    key={p.name || p.$ref || 'unknown'}
                    className="flex items-start gap-2 text-sm bg-muted/50 p-2 rounded"
                  >
                    <code className="font-mono text-primary">{p.name || 'unknown'}</code>
                    {p.in && <span className="text-muted-foreground text-xs">({p.in})</span>}
                    {p.required && <span className="text-red-500 text-xs">required</span>}
                    {p.schema?.type && (
                      <span className="text-xs bg-muted px-1 rounded">
                        {p.schema.type}
                        {p.schema.format && ` (${p.schema.format})`}
                      </span>
                    )}
                    {p.description && <span className="text-muted-foreground text-xs">- {p.description}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {operation.requestBody && (
            <div>
              <h4 className="font-semibold text-sm mb-2">Request Body</h4>
              <div className="bg-muted/50 p-2 rounded">
                {operation.requestBody.required && <span className="text-red-500 text-xs mb-1 block">Required</span>}
                {operation.requestBody.content &&
                  Object.entries(operation.requestBody.content).map(([contentType, content]) => (
                    <div key={contentType}>
                      <span className="text-xs text-muted-foreground">Content-Type: {contentType}</span>
                      {content.schema?.$ref && (
                        <code className="block mt-1 text-xs font-mono">
                          {content.schema.$ref.replace('#/components/schemas/', '')}
                        </code>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {operation.responses && (
            <div>
              <h4 className="font-semibold text-sm mb-2">Responses</h4>
              <div className="space-y-2">
                {Object.entries(operation.responses).map(([code, response]) => {
                  const resp = response as { description?: string; $ref?: string };
                  const statusColor = code.startsWith('2')
                    ? 'text-green-600'
                    : code.startsWith('4')
                      ? 'text-yellow-600'
                      : 'text-red-600';
                  return (
                    <div key={code} className="flex items-center gap-2 text-sm bg-muted/50 p-2 rounded">
                      <span className={`font-mono font-bold ${statusColor}`}>{code}</span>
                      <span className="text-muted-foreground">
                        {resp.description || (resp.$ref ? resp.$ref.replace('#/components/responses/', '') : '')}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <CopyButton text={`${method.toUpperCase()} ${path}`} />
          </div>
        </div>
      )}
    </div>
  );
}

function TagSection({
  tag,
  paths,
  spec,
}: {
  tag: Tag;
  paths: Array<{ path: string; method: HttpMethod; operation: PathOperation }>;
  spec: OpenApiSpec;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="mb-8">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 mb-4 hover:text-primary transition-colors"
      >
        {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        <h3 className="text-xl font-semibold">{tag.name}</h3>
        <span className="text-sm text-muted-foreground">({paths.length} endpoints)</span>
      </button>
      {tag.description && <p className="text-muted-foreground mb-4 ml-7">{tag.description}</p>}
      {isExpanded && (
        <div className="ml-2">
          {paths.map(({ path, method, operation }) => (
            <EndpointCard key={`${method}-${path}`} path={path} method={method} operation={operation} spec={spec} />
          ))}
        </div>
      )}
    </div>
  );
}

export function OpenApiViewer() {
  const [spec, setSpec] = useState<OpenApiSpec | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/openapi.json')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load OpenAPI spec');
        return res.json();
      })
      .then(setSpec)
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return <div className="text-red-500">Error loading API specification: {error}</div>;
  }

  if (!spec) {
    return <div className="text-muted-foreground">Loading API specification...</div>;
  }

  const tags = (spec.tags || []) as Tag[];
  const paths = spec.paths;

  // Group endpoints by tag
  const endpointsByTag = new Map<string, Array<{ path: string; method: HttpMethod; operation: PathOperation }>>();

  // Initialize tags
  for (const tag of tags) {
    endpointsByTag.set(tag.name, []);
  }

  // Group endpoints
  for (const [path, methods] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      const opTags = operation.tags || ['Other'];
      for (const tagName of opTags) {
        const endpoints = endpointsByTag.get(tagName) || [];
        endpoints.push({ path, method: method as HttpMethod, operation });
        endpointsByTag.set(tagName, endpoints);
      }
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b pb-6">
        <h1 className="text-3xl font-bold mb-2">{spec.info.title}</h1>
        <p className="text-muted-foreground mb-4">{spec.info.description}</p>
        <div className="flex flex-wrap gap-4 text-sm">
          <span className="px-2 py-1 bg-muted rounded">Version: {spec.info.version}</span>
          <span className="px-2 py-1 bg-muted rounded">OpenAPI 3.1</span>
          <a
            href="/openapi.json"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            openapi.json
          </a>
          <a
            href="/openapi.yaml"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            openapi.yaml
          </a>
        </div>
      </div>

      {/* Servers */}
      <div>
        <h2 className="text-xl font-semibold mb-3">Base URLs</h2>
        <div className="space-y-2">
          {spec.servers?.map((server) => (
            <div key={server.url} className="flex items-center gap-2 text-sm">
              <code className="px-2 py-1 bg-muted rounded font-mono">{server.url}</code>
              <span className="text-muted-foreground">{server.description}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Authentication */}
      <div>
        <h2 className="text-xl font-semibold mb-3">Authentication</h2>
        <p className="text-muted-foreground mb-4">
          Most endpoints require authentication using a Bearer token or session cookie. Endpoints marked with &quot;Auth
          Required&quot; need authentication.
        </p>
        <div className="bg-muted/50 p-4 rounded-lg">
          <code className="text-sm">Authorization: Bearer &lt;token&gt;</code>
        </div>
      </div>

      {/* Endpoints by Tag */}
      <div>
        <h2 className="text-xl font-semibold mb-6">Endpoints</h2>
        {tags.map((tag) => {
          const tagEndpoints = endpointsByTag.get(tag.name) || [];
          if (tagEndpoints.length === 0) return null;
          return <TagSection key={tag.name} tag={tag} paths={tagEndpoints} spec={spec} />;
        })}
      </div>

      {/* Schemas section */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Data Models</h2>
        <p className="text-muted-foreground mb-4">
          For detailed schema definitions, download the{' '}
          <a href="/openapi.json" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
            OpenAPI specification
          </a>{' '}
          and view the <code>components.schemas</code> section.
        </p>
      </div>
    </div>
  );
}
