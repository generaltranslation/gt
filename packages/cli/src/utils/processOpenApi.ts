import fs from 'node:fs';
import path from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkFrontmatter from 'remark-frontmatter';
import YAML from 'yaml';
import type { Root, Content, Yaml } from 'mdast';
import { logger } from '../console/logger.js';
import { createFileMapping } from '../formats/files/fileMapping.js';
import { Settings } from '../types/index.js';

type SpecAnalysis = {
  absPath: string;
  relativePath: string; // relative to configDir (unused for mapping)
  configPath: string; // as provided in config (for formatting)
  operations: Set<string>;
  schemas: Set<string>;
  webhooks: Set<string>;
};

type ParsedOpenApiValue =
  | {
      kind: 'operation';
      specPath?: string;
      method: string;
      operationPath: string;
    }
  | {
      kind: 'webhook';
      specPath?: string;
      name: string;
    };

type ParsedSchemaValue = {
  specPath?: string;
  schemaName: string;
};

const HTTP_METHODS = new Set([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
  'HEAD',
  'TRACE',
]);

/**
 * Postprocess Mintlify OpenAPI references to point to locale-specific spec files.
 * - Uses openapi.files (ordered) to resolve ambiguities (first match wins).
 * - Relies on the user's json transform rules for locale paths.
 * - Warns on missing/ambiguous references but keeps behavior deterministic.
 */
export default async function processOpenApi(
  settings: Settings,
  includeFiles?: Set<string>
) {
  if (settings.openapi?.framework !== 'mintlify') return;
  if (!settings.openapi.files?.length) return;
  if (!settings.files) return;

  const configDir = path.dirname(settings.config);
  const specAnalyses = buildSpecAnalyses(settings.openapi.files, configDir);
  if (!specAnalyses.length) return;

  const warnings = new Set<string>();
  const { resolvedPaths, placeholderPaths, transformPaths } = settings.files;
  const fileMapping = createFileMapping(
    resolvedPaths,
    placeholderPaths,
    transformPaths,
    settings.locales,
    settings.defaultLocale
  );
  const fileMappingAbs: Record<string, Record<string, string>> = {};
  for (const [locale, mapping] of Object.entries(fileMapping)) {
    fileMappingAbs[locale] = {};
    for (const [src, dest] of Object.entries(mapping)) {
      const absSrc = path.resolve(configDir, src);
      const absDest = path.resolve(configDir, dest);
      fileMappingAbs[locale][absSrc] = absDest;
    }
  }

  // Also rewrite default-locale source files so they use the deterministic spec selection
  const defaultFiles = [
    ...(resolvedPaths.mdx || []),
    ...(resolvedPaths.md || []),
  ];
  for (const filePath of defaultFiles) {
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, 'utf8');
    const updated = rewriteFrontmatter(
      content,
      filePath,
      settings.defaultLocale,
      specAnalyses,
      fileMappingAbs,
      warnings,
      configDir
    );
    if (updated?.changed) {
      await fs.promises.writeFile(filePath, updated.content, 'utf8');
    }
  }

  for (const [locale, filesMap] of Object.entries(fileMapping)) {
    const targetFiles = Object.values(filesMap).filter(
      (p) =>
        (p.endsWith('.md') || p.endsWith('.mdx')) &&
        (!includeFiles || includeFiles.has(p))
    );

    for (const filePath of targetFiles) {
      if (!fs.existsSync(filePath)) continue;
      const content = fs.readFileSync(filePath, 'utf8');
      const updated = rewriteFrontmatter(
        content,
        filePath,
        locale,
        specAnalyses,
        fileMappingAbs,
        warnings,
        configDir
      );

      if (updated?.changed) {
        await fs.promises.writeFile(filePath, updated.content, 'utf8');
      }
    }
  }

  for (const message of warnings) {
    logger.warn(message);
  }
}

function buildSpecAnalyses(
  openapiFiles: string[],
  configDir: string
): SpecAnalysis[] {
  const workspaceRoot = configDir;
  const analyses: SpecAnalysis[] = [];

  for (const configEntry of openapiFiles) {
    const absPath = path.resolve(configDir, configEntry);
    if (!fs.existsSync(absPath)) {
      logger.warn(`OpenAPI file not found: ${configEntry}`);
      continue;
    }
    if (path.extname(absPath).toLowerCase() !== '.json') {
      logger.warn(
        `Skipping OpenAPI file (only .json supported): ${configEntry}`
      );
      continue;
    }

    let spec: unknown;
    try {
      const raw = fs.readFileSync(absPath, 'utf8');
      spec = JSON.parse(raw);
    } catch {
      logger.warn(`Failed to parse OpenAPI JSON: ${configEntry}`);
      continue;
    }

    analyses.push({
      absPath,
      relativePath: path.relative(workspaceRoot, absPath),
      configPath: configEntry,
      operations: extractOperations(spec),
      schemas: extractSchemas(spec),
      webhooks: extractWebhooks(spec),
    });
  }

  return analyses;
}

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null;
}

function extractOperations(spec: unknown): Set<string> {
  const ops = new Set<string>();
  if (!isRecord(spec) || !isRecord(spec.paths)) return ops;
  const paths = spec.paths as Record<string, unknown>;

  for (const [route, methods] of Object.entries(paths)) {
    if (!isRecord(methods)) continue;
    for (const [method, operation] of Object.entries(methods)) {
      if (!isRecord(operation)) continue;
      const upper = method.toUpperCase();
      if (!HTTP_METHODS.has(upper)) continue;
      ops.add(`${upper} ${route}`);
    }
  }
  return ops;
}

function extractSchemas(spec: unknown): Set<string> {
  if (!isRecord(spec) || !isRecord(spec.components)) return new Set();
  const components = spec.components as Record<string, unknown>;
  if (!isRecord(components.schemas)) return new Set();
  return new Set(Object.keys(components.schemas as Record<string, unknown>));
}

function extractWebhooks(spec: unknown): Set<string> {
  if (!isRecord(spec) || !isRecord(spec.webhooks)) return new Set();
  return new Set(Object.keys(spec.webhooks as Record<string, unknown>));
}

function rewriteFrontmatter(
  content: string,
  filePath: string,
  locale: string,
  specs: SpecAnalysis[],
  fileMapping: Record<string, Record<string, string>>,
  warnings: Set<string>,
  configDir: string
): { changed: boolean; content: string } | null {
  let tree: Root;
  try {
    tree = unified()
      .use(remarkParse)
      .use(remarkFrontmatter, ['yaml', 'toml'])
      .parse(content) as Root;
  } catch {
    return null;
  }

  const yamlNode = (tree.children as Content[]).find(
    (node): node is Yaml => (node as Yaml).type === 'yaml'
  );
  if (
    !yamlNode ||
    !yamlNode.position ||
    yamlNode.position.start?.offset === undefined
  ) {
    return null;
  }

  const start = yamlNode.position.start.offset as number;
  const end = yamlNode.position.end.offset as number;
  const frontmatterRaw: string = yamlNode.value || '';

  let parsed: any;
  try {
    parsed = YAML.parse(frontmatterRaw, { prettyErrors: false }) || {};
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') return null;

  let changed = false;

  if (typeof parsed.openapi === 'string') {
    const parsedValue = parseOpenApiValue(parsed.openapi);
    if (parsedValue) {
      const matchKey =
        parsedValue.kind === 'operation'
          ? {
              type: 'operation' as const,
              key: `${parsedValue.method.toUpperCase()} ${parsedValue.operationPath}`,
            }
          : { type: 'webhook' as const, key: parsedValue.name };

      const spec = resolveSpec(
        parsedValue.specPath,
        specs,
        filePath,
        configDir,
        warnings,
        describeOpenApiRef(parsedValue),
        matchKey
      );
      if (spec) {
        const descriptor = formatOpenApiDescriptor(parsedValue);
        const localizedSpecPath = resolveLocalizedSpecPath(
          spec,
          locale,
          fileMapping,
          configDir,
          parsedValue.specPath || spec.configPath
        );
        const newValue = `${localizedSpecPath} ${descriptor}`.trim();
        if (newValue !== parsed.openapi) {
          parsed.openapi = newValue;
          changed = true;
        }
      }
    }
  }

  if (typeof parsed['openapi-schema'] === 'string') {
    const parsedValue = parseSchemaValue(parsed['openapi-schema']);
    if (parsedValue) {
      const spec = resolveSpec(
        parsedValue.specPath,
        specs,
        filePath,
        configDir,
        warnings,
        `schema "${parsedValue.schemaName}"`,
        { type: 'schema', key: parsedValue.schemaName }
      );
      if (spec) {
        const localizedSpecPath = resolveLocalizedSpecPath(
          spec,
          locale,
          fileMapping,
          configDir,
          parsedValue.specPath || spec.configPath
        );
        const newValue =
          `${localizedSpecPath} ${parsedValue.schemaName}`.trim();
        if (newValue !== parsed['openapi-schema']) {
          parsed['openapi-schema'] = newValue;
          changed = true;
        }
      }
    }
  }

  if (!changed) return null;

  const fmString = YAML.stringify(parsed).trimEnd();
  const rebuilt = `${content.slice(0, start)}---\n${fmString}\n---${content.slice(end)}`;
  return { changed, content: rebuilt };
}

function stripWrappingQuotes(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, '');
}

function parseOpenApiValue(value: string): ParsedOpenApiValue | null {
  const stripped = stripWrappingQuotes(value);
  const tokens = stripped.split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;

  let cursor = 0;
  let specPath: string | undefined;
  if (tokens[0].toLowerCase().endsWith('.json')) {
    specPath = tokens[0];
    cursor = 1;
  }
  if (cursor >= tokens.length) return null;

  const keyword = tokens[cursor];
  if (keyword.toLowerCase() === 'webhook') {
    const name = tokens.slice(cursor + 1).join(' ');
    return { kind: 'webhook', specPath, name };
  }

  const method = keyword.toUpperCase();
  const operationPath = tokens.slice(cursor + 1).join(' ');
  if (!operationPath) return null;
  return { kind: 'operation', specPath, method, operationPath };
}

function parseSchemaValue(value: string): ParsedSchemaValue | null {
  const stripped = stripWrappingQuotes(value);
  const tokens = stripped.split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;
  let cursor = 0;
  let specPath: string | undefined;
  if (tokens[0].toLowerCase().endsWith('.json')) {
    specPath = tokens[0];
    cursor = 1;
  }
  const schemaName = tokens.slice(cursor).join(' ');
  if (!schemaName) return null;
  return { specPath, schemaName };
}

function resolveSpec(
  explicitPath: string | undefined,
  specs: SpecAnalysis[],
  filePath: string,
  configDir: string,
  warnings: Set<string>,
  refDescription: string,
  match: { type: 'operation' | 'webhook' | 'schema'; key: string }
): SpecAnalysis | null {
  if (!specs.length) return null;

  if (explicitPath) {
    const candidates = [
      path.resolve(configDir, explicitPath),
      path.resolve(path.dirname(filePath), explicitPath),
    ];
    const match = specs.find((spec) =>
      candidates.some((candidate) => samePath(candidate, spec.absPath))
    );
    if (match) return match;
    warnings.add(
      `OpenAPI reference ${refDescription} in ${filePath} points to an unconfigured spec (${explicitPath}). Skipping localization for this reference.`
    );
    return null;
  }

  // No explicit spec: try to find by contents
  const matches = specs.filter((spec) => {
    if (match.type === 'schema') {
      return spec.schemas.has(match.key);
    }
    if (match.type === 'webhook') {
      return spec.webhooks.has(match.key);
    }
    // operation
    return spec.operations.has(match.key);
  });

  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    warnings.add(
      `OpenAPI reference ${refDescription} in ${filePath} is available in multiple specs. Using the first configured file (${matches[0].configPath}).`
    );
    return matches[0];
  }

  // Not found anywhere, fall back to first configured spec
  warnings.add(
    `OpenAPI reference ${refDescription} in ${filePath} was not found in any configured spec. Using ${specs[0].configPath}.`
  );
  return specs[0];
}

function resolveLocalizedSpecPath(
  spec: SpecAnalysis,
  locale: string,
  fileMapping: Record<string, Record<string, string>>,
  configDir: string,
  originalPathText?: string
): string {
  const mapping = fileMapping[locale]?.[spec.absPath];
  const chosenAbs = mapping || spec.absPath;
  const rel = normalizeSlashes(path.relative(configDir, chosenAbs));
  const rooted = `/${rel.replace(/^\/+/, '')}`;
  return formatSpecPathForFrontmatter(
    rooted,
    originalPathText || spec.configPath
  );
}

function formatSpecPathForFrontmatter(
  relativePath: string,
  originalPathText: string
): string {
  const normalized = normalizeSlashes(relativePath);
  const base = normalized.replace(/^\.\//, '').replace(/\/+/g, '/');

  if (originalPathText.startsWith('/')) {
    // Force repo-root absolute style
    return `/${base.replace(/^\/+/, '')}`;
  }

  if (originalPathText.startsWith('../')) {
    // Preserve explicit relative upward references
    return normalized;
  }

  // Default to repo-root relative with leading slash to avoid resolving relative to the MDX directory
  return `/${base.replace(/^\/+/, '')}`;
}

function formatOpenApiDescriptor(value: ParsedOpenApiValue): string {
  if (value.kind === 'webhook') return `webhook ${value.name}`;
  return `${value.method.toUpperCase()} ${value.operationPath}`;
}

function describeOpenApiRef(value: ParsedOpenApiValue): string {
  if (value.kind === 'webhook') return `webhook ${value.name}`;
  return `${value.method.toUpperCase()} ${value.operationPath}`;
}

function normalizeSlashes(p: string): string {
  return p.replace(/\\/g, '/');
}

function samePath(a: string, b: string): boolean {
  return path.resolve(a) === path.resolve(b);
}
