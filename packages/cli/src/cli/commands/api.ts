import fs from 'node:fs';
import {
  createApiClient,
  type ApiClientConfig,
  type Client,
} from 'generaltranslation/api';
import openApiSpec from 'generaltranslation/api/openapi.json' with { type: 'json' };
import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/diagnostics';
import { resolveApiBaseUrl } from '../../utils/apiBaseUrl.js';
import { createUserTokenProvider } from '../../auth/oauth.js';
import { resolveConfig } from '../../config/resolveConfig.js';
import { exitSync } from '../../console/logging.js';
import { loadConfig, withJsonExtension } from '../../fs/config/loadConfig.js';
import { resolveProjectId } from '../../fs/utils.js';
import type { SharedFlags } from '../../types/index.js';

export type ApiCommandOptions = SharedFlags & {
  header?: string[];
  include?: boolean;
  input?: string;
  list?: boolean;
  method: string;
  spec?: boolean;
};

type ApiCommandDependencies = {
  exit?: (code: number) => never;
  fetch?: ApiClientConfig['fetch'];
  writeStderr?: (output: string) => void;
  writeStdout?: (output: string | Uint8Array) => void;
};

type ApiRequestOptions = Parameters<Client['request']>[0];

const STANDARD_HTTP_METHODS = new Set([
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
]);

function fail(
  diagnostic: string,
  {
    exit = exitSync,
    writeStderr = (output) => process.stderr.write(output),
  }: ApiCommandDependencies
): never {
  writeStderr(`${diagnostic}\n`);
  return exit(1);
}

function parseMethod(
  value: string,
  dependencies: ApiCommandDependencies
): ApiRequestOptions['method'] {
  const method = value.toUpperCase();
  if (!STANDARD_HTTP_METHODS.has(method)) {
    fail(
      createDiagnosticMessage({
        source: 'gt',
        severity: 'Error',
        whatHappened: 'The API request method is invalid',
        details: value,
        fix: `Use one of ${[...STANDARD_HTTP_METHODS].join(', ')}`,
      }),
      dependencies
    );
  }
  // The set validation narrows Commander input to the generated HTTP method union.
  return method as ApiRequestOptions['method'];
}

function parseHeaders(
  values: string[],
  dependencies: ApiCommandDependencies
): Headers {
  const headers = new Headers();
  for (const header of values) {
    const separator = header.indexOf(':');
    if (separator < 1) {
      fail(
        createDiagnosticMessage({
          source: 'gt',
          severity: 'Error',
          whatHappened: 'The API request header is invalid',
          details: header,
          fix: 'Pass headers as `--header "Key: Value"`',
        }),
        dependencies
      );
    }
    headers.append(
      header.slice(0, separator).trim(),
      header.slice(separator + 1).trim()
    );
  }
  return headers;
}

function readInput(
  input: string,
  dependencies: ApiCommandDependencies
): string {
  try {
    return fs.readFileSync(input === '-' ? 0 : input, 'utf8');
  } catch (error) {
    return fail(
      createDiagnosticMessage({
        source: 'gt',
        severity: 'Error',
        whatHappened: 'The API request body could not be read',
        fix:
          input === '-'
            ? 'Pipe a request body to standard input or remove `--input -`'
            : 'Check the `--input` file path and permissions',
        details: formatDiagnosticErrorDetails(error),
      }),
      dependencies
    );
  }
}

type SpecOperation = {
  operationId?: string;
  security?: Record<string, unknown>[];
  summary?: string;
};
const specPaths: Record<
  string,
  Record<string, SpecOperation>
> = openApiSpec.paths;

function listOperations(): string {
  return Object.entries(specPaths)
    .flatMap(([specPath, operations]) =>
      Object.entries(operations).map(
        ([method, operation]) =>
          `${method.toUpperCase()}\t${specPath}\t${operation.operationId ?? ''}\t${operation.summary ?? ''}\n`
      )
    )
    .join('');
}

function lookupRef(ref: string): unknown {
  return ref
    .slice(2)
    .split('/')
    .reduce<unknown>(
      (node, key) => (node as Record<string, unknown> | undefined)?.[key],
      openApiSpec
    );
}

function collectRefs(value: unknown, refs: Set<string>): void {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (key === '$ref' && typeof child === 'string') refs.add(child);
    else collectRefs(child, refs);
  }
}

// Inlines local `#/...` references so one operation reads standalone. A ref
// already being expanded is left as-is because schemas like JsonValue recurse.
function resolveRefs(value: unknown, expanding: string[] = []): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => resolveRefs(item, expanding));
  }
  if (!value || typeof value !== 'object') return value;
  const { $ref, ...siblings } = value as Record<string, unknown>;
  if (typeof $ref === 'string' && $ref.startsWith('#/')) {
    const target = lookupRef($ref);
    if (!expanding.includes($ref) && target && typeof target === 'object') {
      return resolveRefs({ ...target, ...siblings }, [...expanding, $ref]);
    }
    return value;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      resolveRefs(child, expanding),
    ])
  );
}

// Shapes the output like the spec so the recursive refs resolveRefs leaves
// behind and the security requirement names still resolve within it.
function specFragment(
  operations: Record<string, Record<string, SpecOperation>>
): Record<string, unknown> {
  const paths = resolveRefs(operations);
  const components: Record<string, Record<string, unknown>> = {};
  const addComponent = (type: string, name: string, definition: unknown) => {
    components[type] = { ...components[type], [name]: definition };
  };

  const pending = new Set<string>();
  collectRefs(paths, pending);
  const added = new Set<string>();
  for (const ref of pending) {
    const [root, type, name] = ref.slice(2).split('/');
    if (added.has(ref) || root !== 'components' || !type || !name) continue;
    added.add(ref);
    const definition = lookupRef(ref);
    addComponent(type, name, definition);
    // Set iteration visits refs added during the loop.
    collectRefs(definition, pending);
  }

  const securitySchemes: Record<string, unknown> =
    openApiSpec.components.securitySchemes;
  for (const operation of Object.values(operations).flatMap(Object.values)) {
    for (const name of (operation.security ?? []).flatMap(Object.keys)) {
      addComponent('securitySchemes', name, securitySchemes[name]);
    }
  }

  return Object.keys(components).length ? { paths, components } : { paths };
}

// Accepts an operationId, a spec path, or a concrete path such as
// /v2/project/info/abc so agents can look up the request they are about to make.
function findOperations(
  endpoint: string
): Record<string, Record<string, SpecOperation>> {
  const byOperationId = Object.entries(specPaths).flatMap(
    ([specPath, operations]) =>
      Object.entries(operations)
        .filter(([, operation]) => operation.operationId === endpoint)
        .map(([method, operation]) => [specPath, { [method]: operation }])
  );
  if (byOperationId.length) return Object.fromEntries(byOperationId);

  const requestPath = `/${endpoint.replace(/^\//, '').split('?')[0]}`;
  if (specPaths[requestPath]) {
    return { [requestPath]: specPaths[requestPath] };
  }
  return Object.fromEntries(
    Object.entries(specPaths).filter(([specPath]) =>
      new RegExp(
        `^${specPath
          .split(/\{[^}]+\}/)
          .map((literal) => literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('[^/]+')}$`
      ).test(requestPath)
    )
  );
}

function writeResponseMetadata(
  response: Response,
  writeStdout: (output: string | Uint8Array) => void
): void {
  writeStdout(
    `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}\n`
  );
  response.headers.forEach((value, name) => {
    writeStdout(`${name}: ${value}\n`);
  });
  writeStdout('\n');
}

function resolveApiProjectId(
  config: Record<string, unknown>,
  flagProjectId: string | undefined,
  dependencies: ApiCommandDependencies
): string | undefined {
  const configProjectId =
    typeof config.projectId === 'string' ? config.projectId : undefined;
  const environmentProjectId = resolveProjectId();

  if (configProjectId && flagProjectId && configProjectId !== flagProjectId) {
    fail(
      createDiagnosticMessage({
        source: 'gt',
        severity: 'Error',
        whatHappened: 'The project IDs do not match',
        details: [
          `Configuration: ${configProjectId}`,
          `--project-id: ${flagProjectId}`,
        ],
        fix: 'Use the same project ID in all configurations',
      }),
      dependencies
    );
  }

  if (
    configProjectId &&
    environmentProjectId &&
    configProjectId !== environmentProjectId
  ) {
    fail(
      createDiagnosticMessage({
        source: 'gt',
        severity: 'Error',
        whatHappened: 'The project IDs do not match',
        details: [
          `Configuration: ${configProjectId}`,
          `Environment: ${environmentProjectId}`,
        ],
        fix: 'Use the same project ID in all configurations',
      }),
      dependencies
    );
  }

  return flagProjectId ?? configProjectId ?? environmentProjectId;
}

export async function handleApiCommand(
  endpoint: string | undefined,
  options: ApiCommandOptions,
  dependencies: ApiCommandDependencies = {}
): Promise<void> {
  if (!dependencies.writeStdout) {
    process.stdout.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EPIPE') process.exit(0);
      throw error;
    });
  }
  const writeStdout =
    dependencies.writeStdout ?? ((output) => process.stdout.write(output));
  const writeStderr =
    dependencies.writeStderr ?? ((output) => process.stderr.write(output));

  if (options.list) {
    writeStdout(listOperations());
    return;
  }

  if (options.spec) {
    if (!endpoint) {
      writeStdout(`${JSON.stringify(openApiSpec, null, 2)}\n`);
      return;
    }
    const operations = findOperations(endpoint);
    if (!Object.keys(operations).length) {
      fail(
        createDiagnosticMessage({
          source: 'gt',
          severity: 'Error',
          whatHappened: 'No API operation matches the endpoint',
          details: endpoint,
          fix: 'Run `gt api --list` to see the available endpoints and operation IDs',
        }),
        dependencies
      );
    }
    writeStdout(`${JSON.stringify(specFragment(operations), null, 2)}\n`);
    return;
  }

  if (!endpoint) {
    fail(
      createDiagnosticMessage({
        source: 'gt',
        severity: 'Error',
        whatHappened: 'No API endpoint was provided',
        fix: 'Pass an endpoint, run `gt api --list` to see the available endpoints, or run `gt api --spec <endpoint>` to inspect one',
      }),
      dependencies
    );
  }

  const method = parseMethod(options.method, dependencies);
  const config = options.config
    ? loadConfig(withJsonExtension(options.config))
    : (resolveConfig(process.cwd())?.config ?? {});
  const baseUrl = resolveApiBaseUrl(
    typeof config.baseUrl === 'string' ? config.baseUrl : undefined
  );
  const client = createApiClient({
    apiKey: options.apiKey ?? process.env.GT_API_KEY,
    userTokenProvider: createUserTokenProvider({ baseUrl }),
    baseUrl,
    fetch: dependencies.fetch,
    projectId: resolveApiProjectId(config, options.projectId, dependencies),
    retryPolicy: 'none',
  });
  const normalizedEndpoint = endpoint.startsWith('/')
    ? endpoint
    : `/${endpoint}`;
  const headers = parseHeaders(options.header ?? [], dependencies);
  const body = options.input
    ? readInput(options.input, dependencies)
    : undefined;
  let rawResponse: Response | undefined;

  client.interceptors.response.use((response) => {
    // Keep a clone because the generated client consumes non-2xx bodies.
    rawResponse = response.clone();
    return response;
  });

  const result = await client
    .request({
      body,
      bodySerializer: () => body,
      headers,
      method,
      parseAs: 'stream',
      throwOnError: false,
      url: normalizedEndpoint,
    })
    .catch((error) =>
      fail(
        createDiagnosticMessage({
          source: 'gt',
          severity: 'Error',
          whatHappened: 'The API request failed before a response was received',
          details: formatDiagnosticErrorDetails(error),
        }),
        dependencies
      )
    );

  if (!rawResponse) {
    fail(
      createDiagnosticMessage({
        source: 'gt',
        severity: 'Error',
        whatHappened: 'The API request did not return a response',
        details: formatDiagnosticErrorDetails(result?.error),
      }),
      dependencies
    );
  }

  if (options.include) writeResponseMetadata(rawResponse, writeStdout);
  writeStdout(Buffer.from(await rawResponse.arrayBuffer()));

  if (!rawResponse.ok) {
    writeStderr(
      `${method} ${normalizedEndpoint} returned HTTP ${rawResponse.status}${rawResponse.statusText ? ` ${rawResponse.statusText}` : ''}\n`
    );
    (dependencies.exit ?? exitSync)(1);
  }
}
