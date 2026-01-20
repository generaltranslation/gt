import fs from 'node:fs';
import path from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkFrontmatter from 'remark-frontmatter';
import YAML, { isMap, isScalar } from 'yaml';
import type { Root, Content, Yaml } from 'mdast';
import { logger } from '../console/logger.js';
import { createFileMapping } from '../formats/files/fileMapping.js';
import { Settings } from '../types/index.js';

type SpecAnalysis = {
  absPath: string;
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
const OPENAPI_SPEC_EXTENSIONS = new Set(['.json', '.yaml', '.yml']);

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
  const openapiConfig = settings.options?.mintlify?.openapi;
  if (!openapiConfig || !openapiConfig.files?.length) return;
  if (!settings.files) return;

  const configDir = path.dirname(settings.config);
  const specAnalyses = buildSpecAnalyses(openapiConfig.files, configDir);
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

  const docsJsonTargets = collectDocsJsonTargets(
    settings,
    fileMapping,
    includeFiles
  );
  for (const target of docsJsonTargets) {
    if (!fs.existsSync(target.path)) continue;
    const content = fs.readFileSync(target.path, 'utf8');
    const updated = rewriteDocsJsonOpenApi(
      content,
      target.path,
      target.localeHint,
      specAnalyses,
      fileMappingAbs,
      fileMapping,
      warnings,
      configDir,
      settings.defaultLocale
    );
    if (updated?.changed) {
      await fs.promises.writeFile(target.path, updated.content, 'utf8');
    }
  }

  for (const message of warnings) {
    logger.warn(message);
  }
}

function collectDocsJsonTargets(
  settings: Settings,
  fileMapping: Record<string, Record<string, string>>,
  includeFiles?: Set<string>
): Array<{ path: string; localeHint?: string }> {
  const targets: Array<{ path: string; localeHint?: string }> = [];
  const seen = new Map<string, Set<string>>();

  const addTarget = (filePath: string, locale?: string) => {
    const canonicalPath = path.resolve(filePath);
    if (
      includeFiles &&
      !includeFiles.has(filePath) &&
      !includeFiles.has(canonicalPath)
    ) {
      return;
    }
    const locales = seen.get(canonicalPath) ?? new Set<string>();
    if (locale) locales.add(locale);
    seen.set(canonicalPath, locales);
  };

  if (!includeFiles && settings.files?.resolvedPaths.json) {
    for (const filePath of settings.files.resolvedPaths.json) {
      addTarget(filePath, settings.defaultLocale);
    }
  }

  for (const [locale, filesMap] of Object.entries(fileMapping)) {
    for (const filePath of Object.values(filesMap)) {
      if (!filePath.endsWith('.json')) continue;
      addTarget(filePath, locale);
    }
  }

  for (const [filePath, locales] of seen.entries()) {
    const localeHint = locales.size === 1 ? Array.from(locales)[0] : undefined;
    targets.push({ path: filePath, localeHint });
  }

  return targets;
}

function isMintlifyDocsJson(filePath: string, json: unknown): boolean {
  if (!isRecord(json)) return false;
  const schema = json.$schema;
  if (typeof schema === 'string') {
    return (
      schema.includes('mintlify.com/docs.json') ||
      schema.includes('mintlify.com/mint.json')
    );
  }
  const base = path.basename(filePath);
  return base === 'docs.json' || base === 'mint.json';
}

function rewriteDocsJsonOpenApi(
  content: string,
  filePath: string,
  localeHint: string | undefined,
  specs: SpecAnalysis[],
  fileMappingAbs: Record<string, Record<string, string>>,
  fileMappingRel: Record<string, Record<string, string>>,
  warnings: Set<string>,
  configDir: string,
  defaultLocale: string
): { changed: boolean; content: string } | null {
  let json: unknown;
  try {
    json = JSON.parse(content);
  } catch {
    return null;
  }

  if (!isMintlifyDocsJson(filePath, json)) return null;

  let changed = false;

  const visitNode = (node: unknown, activeLocale?: string) => {
    if (Array.isArray(node)) {
      node.forEach((item) => visitNode(item, activeLocale));
      return;
    }
    if (!isRecord(node)) return;

    let nextLocale = activeLocale;
    if (typeof node.language === 'string') {
      nextLocale = node.language;
    }

    if (isRecord(node.openapi) && Array.isArray(node.pages)) {
      const locale = nextLocale || localeHint || defaultLocale;
      const openapiConfig = node.openapi as Record<string, unknown>;
      const sourceValue = openapiConfig.source;
      if (typeof sourceValue === 'string') {
        const localizedSource = localizeDocsJsonSpecPath(
          sourceValue,
          locale,
          filePath,
          specs,
          fileMappingAbs,
          fileMappingRel,
          warnings,
          configDir
        );
        if (localizedSource && localizedSource !== sourceValue) {
          openapiConfig.source = localizedSource;
          changed = true;
        }
      }

      const pages = node.pages;
      for (let i = 0; i < pages.length; i += 1) {
        const page = pages[i];
        if (typeof page !== 'string') continue;
        const updated = stripLocaleFromOpenApiPage(page, locale);
        if (updated !== page) {
          pages[i] = updated;
          changed = true;
        }
      }
    }

    for (const value of Object.values(node)) {
      visitNode(value, nextLocale);
    }
  };

  visitNode(json, undefined);

  if (!changed) return null;
  return { changed, content: JSON.stringify(json, null, 2) };
}

function stripLocaleFromOpenApiPage(value: string, locale: string): string {
  const trimmed = value.trim();
  const prefix = `${locale}/`;
  if (!trimmed.startsWith(prefix)) return value;
  const candidate = trimmed.slice(prefix.length);
  const parsed = parseOpenApiValue(candidate);
  if (!parsed) return value;
  return candidate;
}

function localizeDocsJsonSpecPath(
  source: string,
  locale: string,
  filePath: string,
  specs: SpecAnalysis[],
  fileMappingAbs: Record<string, Record<string, string>>,
  _fileMappingRel: Record<string, Record<string, string>>,
  warnings: Set<string>,
  configDir: string
): string | null {
  const resolvedAbs = resolveDocsJsonSpecPath(source, filePath, configDir);
  const matched = matchSpecBySource(source, resolvedAbs, specs, warnings);
  if (!matched) return source;

  const localizedSpecPath = resolveLocalizedSpecPath(
    matched,
    locale,
    fileMappingAbs,
    configDir,
    source
  );
  const localizedAbs = resolveDocsJsonSpecPath(
    localizedSpecPath,
    filePath,
    configDir
  );
  if (!fs.existsSync(localizedAbs)) {
    warnings.add(
      `OpenAPI source "${source}" localized for locale "${locale}" points to a missing file (${localizedAbs}). Keeping original source.`
    );
    return source;
  }

  const rel = normalizeSlashes(path.relative(configDir, localizedAbs));
  return formatSpecPathForDocsJson(rel, source);
}

function resolveDocsJsonSpecPath(
  source: string,
  filePath: string,
  configDir: string
): string {
  if (source.startsWith('/')) {
    return path.resolve(configDir, source.replace(/^\/+/, ''));
  }
  if (source.startsWith('./') || source.startsWith('../')) {
    return path.resolve(path.dirname(filePath), source);
  }
  return path.resolve(configDir, source);
}

function matchSpecBySource(
  source: string,
  resolvedAbs: string,
  specs: SpecAnalysis[],
  warnings: Set<string>
): SpecAnalysis | null {
  const exact = specs.find((spec) => samePath(resolvedAbs, spec.absPath));
  if (exact) return exact;

  const normalizedExplicit = normalizeSlashes(source).replace(/^\.?\/+/, '');
  const explicitWithoutExt = stripExtension(normalizedExplicit);
  const explicitBase = path.basename(normalizedExplicit);
  const explicitBaseWithoutExt = stripExtension(explicitBase);
  const matches = specs.filter((spec) => {
    const configPath = normalizeSlashes(spec.configPath).replace(/^\.?\/+/, '');
    const configBase = path.basename(configPath);
    const configPathNoExt = stripExtension(configPath);
    const configBaseNoExt = stripExtension(configBase);
    return (
      configPath === normalizedExplicit ||
      configPathNoExt === explicitWithoutExt ||
      configBase === explicitBase ||
      configBaseNoExt === explicitBaseWithoutExt
    );
  });

  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    warnings.add(
      `OpenAPI source "${source}" matches multiple specs (${matches
        .map((m) => m.configPath)
        .join(
          ', '
        )}). Using the first configured match (${matches[0].configPath}).`
    );
    return matches[0];
  }

  return null;
}

function formatSpecPathForDocsJson(
  relativePath: string,
  originalPathText: string
): string {
  const normalized = normalizeSlashes(relativePath);
  const base = normalized.replace(/^\.\//, '').replace(/\/+/g, '/');

  if (originalPathText.startsWith('/')) {
    return `/${base.replace(/^\/+/, '')}`;
  }
  if (originalPathText.startsWith('../')) {
    return normalized;
  }
  if (originalPathText.startsWith('./')) {
    return `./${base.replace(/^\/+/, '')}`;
  }
  return base.replace(/^\/+/, '');
}

/**
 * Resolve configured OpenAPI files to absolute paths and collect the operations,
 * schemas, and webhooks they expose. Warns and skips when files are missing,
 * unsupported (non-JSON/YAML), or fail to parse so later steps can continue gracefully.
 */
function buildSpecAnalyses(
  openapiFiles: string[],
  configDir: string
): SpecAnalysis[] {
  const analyses: SpecAnalysis[] = [];

  for (const configEntry of openapiFiles) {
    const absPath = path.resolve(configDir, configEntry);
    if (!fs.existsSync(absPath)) {
      logger.warn(`OpenAPI file not found: ${configEntry}`);
      continue;
    }
    const ext = path.extname(absPath).toLowerCase();
    if (!OPENAPI_SPEC_EXTENSIONS.has(ext)) {
      logger.warn(
        `Skipping OpenAPI file (only .json/.yml/.yaml supported): ${configEntry}`
      );
      continue;
    }

    let spec: unknown;
    try {
      const raw = fs.readFileSync(absPath, 'utf8');
      spec = ext === '.json' ? JSON.parse(raw) : YAML.parse(raw);
    } catch {
      const format = ext === '.json' ? 'JSON' : 'YAML';
      logger.warn(`Failed to parse OpenAPI ${format}: ${configEntry}`);
      continue;
    }

    analyses.push({
      absPath,
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

/**
 * Collect path+method identifiers (e.g., "POST /foo") from an OpenAPI spec.
 * Safely no-ops when paths is missing or malformed.
 */
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

/**
 * Collect schema names from components.schemas.
 * Returns empty set if components/schemas are missing or malformed.
 */
function extractSchemas(spec: unknown): Set<string> {
  if (!isRecord(spec) || !isRecord(spec.components)) return new Set();
  const components = spec.components as Record<string, unknown>;
  if (!isRecord(components.schemas)) return new Set();
  return new Set(Object.keys(components.schemas as Record<string, unknown>));
}

/**
 * Collect webhook names from webhooks (OpenAPI 3.1+).
 * Returns empty set if webhooks is missing or malformed.
 */
function extractWebhooks(spec: unknown): Set<string> {
  if (!isRecord(spec) || !isRecord(spec.webhooks)) return new Set();
  return new Set(Object.keys(spec.webhooks as Record<string, unknown>));
}

/**
 * Parse MDX/MD frontmatter, rewrite openapi/openapi-schema entries to the
 * resolved (possibly localized) spec path, and return updated content.
 * Uses remark to find the YAML node so the rest of the document remains
 * untouched. When parsing fails or no relevant keys exist, it returns null.
 */
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

  const doc = YAML.parseDocument(frontmatterRaw, {
    prettyErrors: false,
    keepSourceTokens: true,
  });
  if (doc.errors?.length) return null;
  if (!isMap(doc.contents)) return null;

  let changed = false;

  const openapiNode = doc.get('openapi', true);
  if (isScalar(openapiNode) && typeof openapiNode.value === 'string') {
    const parsedValue = parseOpenApiValue(openapiNode.value);
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
        if (newValue !== openapiNode.value) {
          doc.set('openapi', newValue);
          changed = true;
        }
      }
    }
  }

  const schemaNode = doc.get('openapi-schema', true);
  if (isScalar(schemaNode) && typeof schemaNode.value === 'string') {
    const parsedValue = parseSchemaValue(schemaNode.value);
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
        if (newValue !== schemaNode.value) {
          doc.set('openapi-schema', newValue);
          changed = true;
        }
      }
    }
  }

  if (!changed) return null;

  const fmString = doc.toString().trimEnd();
  const rebuilt = `${content.slice(0, start)}---\n${fmString}\n---${content.slice(end)}`;
  return { changed, content: rebuilt };
}

function stripWrappingQuotes(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, '');
}

/**
 * Parse frontmatter openapi string into spec/method/path or webhook.
 * Supports optional leading spec file, the webhook keyword, quoted values,
 * and forgiving whitespace. Returns null when the structure is unrecognized.
 */
function parseOpenApiValue(value: string): ParsedOpenApiValue | null {
  const stripped = stripWrappingQuotes(value);
  const tokens = stripped.split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;

  let cursor = 0;
  let specPath: string | undefined;
  const first = tokens[0];
  const second = tokens[1];
  const methodCandidate = second?.toUpperCase();
  const firstLooksLikeSpec =
    hasOpenApiSpecExtension(first) ||
    (second &&
      (second.toLowerCase() === 'webhook' ||
        (methodCandidate && HTTP_METHODS.has(methodCandidate))));

  if (firstLooksLikeSpec) {
    specPath = tokens[0];
    cursor = 1;
  }
  if (cursor >= tokens.length) return null;

  const keyword = tokens[cursor];
  if (keyword.toLowerCase() === 'webhook') {
    const name = tokens.slice(cursor + 1).join(' ');
    if (!name) return null;
    return { kind: 'webhook', specPath, name };
  }

  const method = keyword.toUpperCase();
  if (!HTTP_METHODS.has(method)) return null;
  const operationPath = tokens.slice(cursor + 1).join(' ');
  if (!operationPath) return null;
  return { kind: 'operation', specPath, method, operationPath };
}

/**
 * Parse frontmatter openapi-schema string into spec/schemaName.
 * Accepts optional leading spec file and quoted values; returns null on invalid
 * shapes so callers can skip rewrites gracefully.
 */
function parseSchemaValue(value: string): ParsedSchemaValue | null {
  const stripped = stripWrappingQuotes(value);
  const tokens = stripped.split(/\s+/).filter(Boolean);
  if (!tokens.length) return null;
  let cursor = 0;
  let specPath: string | undefined;
  if (hasOpenApiSpecExtension(tokens[0])) {
    specPath = tokens[0];
    cursor = 1;
  }
  const schemaName = tokens.slice(cursor).join(' ');
  if (!schemaName) return null;
  return { specPath, schemaName };
}

/**
 * Choose which configured spec a reference should use.
 * - If an explicit spec path is provided, resolve it relative to the config
 *   and the referencing file, warn when unknown, and bail.
 * - Otherwise, try to match by operation/webhook/schema name; resolve
 *   ambiguity using config order and warn when ambiguous or missing.
 */
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
    const normalizedExplicit = normalizeSlashes(
      explicitPath.replace(/^\.?\/+/, '')
    );
    const candidates = [
      path.resolve(configDir, normalizedExplicit),
      path.resolve(path.dirname(filePath), normalizedExplicit),
    ];
    const foundSpec = specs.find((spec) => {
      const normalizedSpecPath = normalizeSlashes(spec.absPath);
      return candidates.some((candidate) =>
        samePath(candidate, normalizedSpecPath)
      );
    });
    if (foundSpec) {
      if (specHasMatch(foundSpec, match)) {
        return foundSpec;
      }

      const alternatives = specs.filter(
        (spec) => spec !== foundSpec && specHasMatch(spec, match)
      );
      if (alternatives.length === 1) {
        warnings.add(
          `OpenAPI reference ${refDescription} in ${filePath} points to ${foundSpec.configPath}, but the entry was not found there. Using ${alternatives[0].configPath} instead.`
        );
        return alternatives[0];
      }
      if (alternatives.length > 1) {
        warnings.add(
          `OpenAPI reference ${refDescription} in ${filePath} points to ${foundSpec.configPath}, but the entry was not found there and matches multiple specs (${alternatives
            .map((spec) => spec.configPath)
            .join(', ')}). Skipping localization for this reference.`
        );
        return null;
      }

      warnings.add(
        `OpenAPI reference ${refDescription} in ${filePath} points to ${foundSpec.configPath}, but the entry was not found in any configured spec. Skipping localization for this reference.`
      );
      return null;
    }

    const explicitWithoutExt = stripExtension(normalizedExplicit);
    const explicitBase = path.basename(normalizedExplicit);
    const explicitBaseWithoutExt = stripExtension(explicitBase);
    const matches = specs.filter((spec) => {
      const configPath = normalizeSlashes(spec.configPath).replace(
        /^\.?\/+/,
        ''
      );
      const configBase = path.basename(configPath);
      const configPathNoExt = stripExtension(configPath);
      const configBaseNoExt = stripExtension(configBase);
      return (
        configPath === normalizedExplicit ||
        configPathNoExt === explicitWithoutExt ||
        configBase === explicitBase ||
        configBaseNoExt === explicitBaseWithoutExt
      );
    });
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      warnings.add(
        `OpenAPI reference ${refDescription} in ${filePath} matches multiple specs (${matches
          .map((m) => m.configPath)
          .join(
            ', '
          )}). Using the first configured match (${matches[0].configPath}).`
      );
      return matches[0];
    }

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
      `OpenAPI reference ${refDescription} in ${filePath} is available in multiple specs. Skipping localization for this reference.`
    );
    return null;
  }

  warnings.add(
    `OpenAPI reference ${refDescription} in ${filePath} was not found in any configured spec. Skipping localization for this reference.`
  );
  return null;
}

function specHasMatch(
  spec: SpecAnalysis,
  match: { type: 'operation' | 'webhook' | 'schema'; key: string }
): boolean {
  if (match.type === 'schema') {
    return spec.schemas.has(match.key);
  }
  if (match.type === 'webhook') {
    return spec.webhooks.has(match.key);
  }
  return spec.operations.has(match.key);
}

/**
 * Map a spec to the locale-specific file path when available and normalize it
 * for frontmatter. Falls back to the source spec when the locale copy does
 * not exist to preserve deterministic behavior.
 */
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

/**
 * Format the path that will be written back to frontmatter:
 * - Preserve the user's absolute style when they used a leading slash.
 * - Preserve upward relative references (../) exactly.
 * - Otherwise return a repo-root-relative path with a leading slash so Mintlify
 *   resolves consistently regardless of the MDX file location.
 */
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

/** Normalize the descriptive portion after the spec path for frontmatter. */
function formatOpenApiDescriptor(value: ParsedOpenApiValue): string {
  if (value.kind === 'webhook') return `webhook ${value.name}`;
  return `${value.method.toUpperCase()} ${value.operationPath}`;
}

/** Human-readable description a specific OpenAPI reference. */
function describeOpenApiRef(value: ParsedOpenApiValue): string {
  if (value.kind === 'webhook') return `webhook ${value.name}`;
  return `${value.method.toUpperCase()} ${value.operationPath}`;
}

/** Remove a single trailing file extension while preserving directory segments. */
function stripExtension(p: string): string {
  const parsed = path.parse(p);
  return normalizeSlashes(path.join(parsed.dir, parsed.name));
}

function hasOpenApiSpecExtension(value: string): boolean {
  return OPENAPI_SPEC_EXTENSIONS.has(path.extname(value).toLowerCase());
}

/** Normalize separators for stable comparisons and output. */
function normalizeSlashes(p: string): string {
  return p.replace(/\\/g, '/');
}

/** Compare paths after resolution to avoid casing/separator mismatches. */
function samePath(a: string, b: string): boolean {
  return path.resolve(a) === path.resolve(b);
}
