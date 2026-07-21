import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_SEPARATORS, type Separators } from './catalogConvert.js';

const traverse: typeof traverseModule =
  (traverseModule as { default?: typeof traverseModule }).default ||
  traverseModule;

export type I18nextConfig = {
  locales: string[] | null;
  defaultLocale: string | null;
  defaultNS: string;
  namespaces: string[] | null;
  separators: Separators;
  /** absolute path of the config file the options were read from, if any. */
  configFile: string | null;
  /** set when the config uses an option gt migrate cannot honor safely. */
  refuseReason: string | null;
};

const CONFIG_CANDIDATES = [
  'i18n.ts',
  'i18n.js',
  'i18n.tsx',
  'src/i18n.ts',
  'src/i18n.js',
  'i18next.config.ts',
  'i18next.config.js',
  'next-i18next.config.js',
  'app/i18n/settings.ts',
  'app/i18n/settings.js',
  'app/i18n/index.ts',
  'app/i18n/index.js',
  'app/i18n.ts',
  'src/app/i18n/settings.ts',
  'src/app/i18n/index.ts',
  'i18n/settings.ts',
  'i18n/index.ts',
  'src/i18n/settings.ts',
  'src/i18n/index.ts',
];

const SCAN_DIRS = [
  'app/i18n',
  'src/app/i18n',
  'i18n',
  'src/i18n',
  'lib/i18n',
  'src/lib/i18n',
];

const DEFAULT_NS = 'translation';

const KEY_SEPARATOR_REFUSAL =
  'i18next `keySeparator: false` (flat keys) cannot map onto gt-next dotted-path dictionary resolution; migrate those keys manually';

function interpolationRefusal(prefix: unknown, suffix: unknown): string {
  return `i18next uses a non-default interpolation delimiter (prefix ${JSON.stringify(prefix)}, suffix ${JSON.stringify(suffix)}); gt migrate only understands the default {{ }} delimiters, so migrate manually`;
}

function isNonDefaultDelimiter(interp: Record<string, unknown>): boolean {
  const { prefix, suffix } = interp;
  return (
    (typeof prefix === 'string' && prefix !== '{{') ||
    (typeof suffix === 'string' && suffix !== '}}')
  );
}

const cache = new Map<string, I18nextConfig>();

/**
 * Reads the app's i18next init config to recover the facts the converter and
 * transforms need: locales, default locale, default namespace, namespace list,
 * and any separator overrides. Memoized per cwd. Never throws — an unreadable
 * config yields sensible defaults (the filesystem is the ground truth for the
 * locale/namespace *set*; this only supplies defaultNS and separators reliably).
 */
export function getI18nextConfig(cwd: string): I18nextConfig {
  const cached = cache.get(cwd);
  if (cached) return cached;
  const result = parseConfig(cwd);
  cache.set(cwd, result);
  return result;
}

/** Test-only: clears the per-cwd config cache. */
export function clearI18nextConfigCache(): void {
  cache.clear();
}

function parseConfig(cwd: string): I18nextConfig {
  const config: I18nextConfig = {
    locales: null,
    defaultLocale: null,
    defaultNS: DEFAULT_NS,
    namespaces: null,
    separators: { ...DEFAULT_SEPARATORS },
    configFile: null,
    refuseReason: null,
  };

  for (const file of configFiles(cwd)) {
    let source: string;
    try {
      source = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    if (!/i18n|fallbackLng|supportedLngs|defaultNS/i.test(source)) continue;
    const { options, refuseReason } = extractOptions(source);
    // A refusal signal (keySeparator: false, non-default interpolation) counts
    // wherever it appears in the file, including a spread base object that
    // scores lower than the init object, so OR it in regardless of the best
    // object (the M4 finding).
    if (refuseReason) config.refuseReason = config.refuseReason ?? refuseReason;
    if (!options) continue;
    config.configFile = config.configFile ?? file;
    applyOptions(config, options);
    // Once we have both locales and (implicitly) defaultNS, we can stop — but
    // keep scanning if locales are still unknown.
    if (config.locales && config.locales.length > 0) break;
  }

  return config;
}

function configFiles(cwd: string): string[] {
  const files: string[] = [];
  for (const candidate of CONFIG_CANDIDATES) {
    const full = path.join(cwd, candidate);
    if (fs.existsSync(full)) files.push(full);
  }
  for (const dir of SCAN_DIRS) {
    const full = path.join(cwd, dir);
    let entries: string[] = [];
    try {
      if (!fs.existsSync(full) || !fs.statSync(full).isDirectory()) continue;
      entries = fs.readdirSync(full);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry)) {
        const p = path.join(full, entry);
        if (!files.includes(p)) files.push(p);
      }
    }
  }
  return files;
}

type RawOptions = {
  fallbackLng?: unknown;
  supportedLngs?: unknown;
  lng?: unknown;
  defaultNS?: unknown;
  ns?: unknown;
  keySeparator?: unknown;
  nsSeparator?: unknown;
  contextSeparator?: unknown;
  pluralSeparator?: unknown;
  interpolation?: unknown;
};

/**
 * Finds the first ObjectExpression carrying recognizable i18next option keys
 * and evaluates its literal-valued properties. Handles the common shapes:
 * `i18next.init({...})`, `.use(initReactI18next).init({...})`, and an options
 * object returned from a `getOptions()` helper.
 */
function extractOptions(source: string): {
  options: RawOptions | null;
  refuseReason: string | null;
} {
  let ast: t.File;
  try {
    ast = parse(source, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });
  } catch {
    return { options: null, refuseReason: null };
  }
  const recognized = new Set([
    'fallbackLng',
    'supportedLngs',
    'defaultNS',
    'ns',
    'keySeparator',
    'nsSeparator',
    'contextSeparator',
    'pluralSeparator',
    'lng',
  ]);

  // The official i18next App Router example declares the settings as
  // module-level consts (`export const defaultNS = 'translation'`) and then
  // references them with shorthand in getOptions ({ defaultNS, fallbackLng }).
  // Collect those const bindings so an identifier value resolves to its literal
  // instead of being dropped as non-literal.
  const consts = collectConstLiterals(ast);

  let best: RawOptions | null = null;
  let bestScore = 0;
  let refuseReason: string | null = null;
  traverse(ast, {
    ObjectExpression(pathNode) {
      let score = 0;
      const options: RawOptions = {};
      for (const property of pathNode.node.properties) {
        if (
          !t.isObjectProperty(property) ||
          property.computed ||
          !t.isIdentifier(property.key)
        ) {
          continue;
        }
        const name = property.key.name;
        const value = literalValue(property.value, consts);
        if (recognized.has(name) && value !== undefined) score++;
        (options as Record<string, unknown>)[name] = value;
        // Refusal scan across EVERY option object (spread bases included), so a
        // keySeparator: false / non-default delimiter hidden in a lower-scoring
        // object is still caught.
        if (name === 'keySeparator' && value === false) {
          refuseReason = refuseReason ?? KEY_SEPARATOR_REFUSAL;
        } else if (
          name === 'interpolation' &&
          value !== null &&
          typeof value === 'object' &&
          isNonDefaultDelimiter(value as Record<string, unknown>)
        ) {
          const interp = value as Record<string, unknown>;
          refuseReason =
            refuseReason ?? interpolationRefusal(interp.prefix, interp.suffix);
        }
      }
      if (score > bestScore) {
        bestScore = score;
        best = options;
      }
    },
  });
  return { options: bestScore > 0 ? best : null, refuseReason };
}

/** Maps every `const <id> = <literal>` in the file to its resolved value, so
 *  shorthand references (`{ defaultNS }`) can be resolved to their string. */
function collectConstLiterals(ast: t.File): Map<string, unknown> {
  const consts = new Map<string, unknown>();
  traverse(ast, {
    VariableDeclarator(path) {
      if (
        path.node.init &&
        t.isIdentifier(path.node.id) &&
        !consts.has(path.node.id.name)
      ) {
        const value = literalValue(path.node.init);
        if (value !== undefined) consts.set(path.node.id.name, value);
      }
    },
  });
  return consts;
}

function literalValue(node: t.Node, consts?: Map<string, unknown>): unknown {
  if (t.isStringLiteral(node)) return node.value;
  if (t.isBooleanLiteral(node)) return node.value;
  if (t.isNumericLiteral(node)) return node.value;
  if (t.isNullLiteral(node)) return null;
  if (consts && t.isIdentifier(node) && consts.has(node.name)) {
    return consts.get(node.name);
  }
  if (t.isArrayExpression(node)) {
    const values: unknown[] = [];
    for (const element of node.elements) {
      if (element && t.isStringLiteral(element)) values.push(element.value);
    }
    return values;
  }
  if (t.isObjectExpression(node)) {
    const object: Record<string, unknown> = {};
    for (const property of node.properties) {
      if (
        t.isObjectProperty(property) &&
        !property.computed &&
        t.isIdentifier(property.key)
      ) {
        object[property.key.name] = literalValue(property.value, consts);
      }
    }
    return object;
  }
  return undefined;
}

function applyOptions(config: I18nextConfig, options: RawOptions): void {
  const locales = normalizeLocales(
    options.supportedLngs ?? options.fallbackLng
  );
  if (locales && !config.locales) config.locales = locales;

  const fallback = firstString(options.fallbackLng) ?? firstString(options.lng);
  if (fallback && !config.defaultLocale) config.defaultLocale = fallback;

  if (typeof options.defaultNS === 'string')
    config.defaultNS = options.defaultNS;
  else if (
    Array.isArray(options.defaultNS) &&
    typeof options.defaultNS[0] === 'string'
  ) {
    config.defaultNS = options.defaultNS[0];
  }

  const ns = normalizeLocales(options.ns);
  if (ns && !config.namespaces) config.namespaces = ns;

  if (options.keySeparator === false) {
    config.separators.keySeparator = false;
    config.refuseReason = config.refuseReason ?? KEY_SEPARATOR_REFUSAL;
  } else if (typeof options.keySeparator === 'string') {
    config.separators.keySeparator = options.keySeparator;
  }
  if (typeof options.nsSeparator === 'string') {
    config.separators.nsSeparator = options.nsSeparator;
  } else if (options.nsSeparator === false) {
    config.separators.nsSeparator = false;
  }
  if (typeof options.contextSeparator === 'string') {
    config.separators.contextSeparator = options.contextSeparator;
  }
  if (typeof options.pluralSeparator === 'string') {
    config.separators.pluralSeparator = options.pluralSeparator;
  }

  if (options.interpolation && typeof options.interpolation === 'object') {
    const interp = options.interpolation as Record<string, unknown>;
    if (isNonDefaultDelimiter(interp)) {
      config.refuseReason =
        config.refuseReason ??
        interpolationRefusal(interp.prefix, interp.suffix);
    }
  }
}

function normalizeLocales(value: unknown): string[] | null {
  if (typeof value === 'string') {
    return value === 'cimode' ? null : [value];
  }
  if (Array.isArray(value)) {
    const strings = value.filter(
      (v): v is string => typeof v === 'string' && v !== 'cimode'
    );
    return strings.length > 0 ? strings : null;
  }
  return null;
}

function firstString(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  if (value && typeof value === 'object') {
    // fallbackLng can be a map like { default: ['en'] }.
    const def = (value as Record<string, unknown>).default;
    if (typeof def === 'string') return def;
    if (Array.isArray(def) && typeof def[0] === 'string') return def[0];
  }
  return null;
}
