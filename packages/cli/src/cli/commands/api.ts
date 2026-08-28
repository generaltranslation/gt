import fs from 'node:fs';
import { createRequire } from 'node:module';
import {
  createApiClient,
  type ApiClientConfig,
  type Client,
} from 'generaltranslation/api';
import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/diagnostics';
import { defaultBaseUrl } from 'generaltranslation/internal';
import { resolveConfig } from '../../config/resolveConfig.js';
import { exitSync } from '../../console/logging.js';
import { loadConfig } from '../../fs/config/loadConfig.js';
import { resolveProjectId } from '../../fs/utils.js';
import type { SharedFlags } from '../../types/index.js';

export type ApiCommandOptions = SharedFlags & {
  header?: string[];
  include?: boolean;
  input?: string;
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

  if (options.spec) {
    const require = createRequire(import.meta.url);
    const specPath = require.resolve('generaltranslation/api/openapi.json');
    const spec: unknown = JSON.parse(fs.readFileSync(specPath, 'utf8'));
    writeStdout(`${JSON.stringify(spec, null, 2)}\n`);
    return;
  }

  if (!endpoint) {
    fail(
      createDiagnosticMessage({
        source: 'gt',
        severity: 'Error',
        whatHappened: 'No API endpoint was provided',
        fix: 'Pass an endpoint or use `gt api --spec` to inspect the OpenAPI specification',
      }),
      dependencies
    );
  }

  const method = parseMethod(options.method, dependencies);
  const configPath = options.config?.endsWith('.json')
    ? options.config
    : options.config
      ? `${options.config}.json`
      : undefined;
  const config = configPath
    ? loadConfig(configPath)
    : (resolveConfig(process.cwd())?.config ?? {});
  const client = createApiClient({
    apiKey: options.apiKey ?? process.env.GT_API_KEY,
    baseUrl:
      typeof config.baseUrl === 'string' ? config.baseUrl : defaultBaseUrl,
    fetch: dependencies.fetch,
    projectId:
      options.projectId ??
      (typeof config.projectId === 'string'
        ? config.projectId
        : resolveProjectId()),
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
