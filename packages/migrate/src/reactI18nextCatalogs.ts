import fs from 'node:fs';
import path from 'node:path';
import { matchFiles } from './fs/matchFiles.js';
import {
  CatalogConversionError,
  convertCatalogs,
  type ConvertInput,
} from './catalogConvert.js';
import { getI18nextConfig } from './reactI18nextConfig.js';
import { collectCallSiteEvidence } from './reactI18nextEvidence.js';
import type {
  FileEdit,
  MessageCatalogs,
  MigrationContext,
  RoutingInfo,
} from './types.js';

/** Directories an i18next app conventionally keeps `{lng}/{ns}.json` under. */
const LOCALE_ROOTS = [
  'public/locales',
  'locales',
  'src/locales',
  'app/i18n/locales',
  'src/app/i18n/locales',
  'app/locales',
  'src/app/locales',
];

/** New output dirs for the converted ICU dictionaries (never a user catalog). */
const OUTPUT_DIR_CANDIDATES = [
  'gt/dictionaries',
  'gt/dictionaries-icu',
  'gt/messages',
];

/**
 * Reads i18next's per-namespace `{lng}/{ns}.json` catalogs, converts every
 * value to ICU (suffix plurals/ordinals/context selectors, `{{var}}`
 * interpolation, `$t()` nesting), merges the namespaces into one dictionary per
 * locale (defaultNS at root, others nested), and returns them pointed at a NEW
 * output directory. The user's original catalogs are never read for mutation and
 * never written to; only new files under `gt/dictionaries/` are produced (by
 * emitReactI18nextCatalogs during the write phase).
 *
 * Throws CatalogConversionError when the app uses an i18next option gt migrate
 * cannot honor safely (e.g. `keySeparator: false`), so the driver refuses the
 * run with a specific message instead of silently mis-nesting keys.
 */
export async function discoverReactI18nextCatalogs(
  cwd: string,
  routing: RoutingInfo
): Promise<MessageCatalogs | null> {
  const config = getI18nextConfig(cwd);
  if (config.refuseReason) {
    throw new CatalogConversionError(config.refuseReason);
  }

  const root = LOCALE_ROOTS.map((rel) => path.join(cwd, rel)).find((dir) =>
    isLocaleRoot(dir)
  );
  if (!root) return null;

  const localeDirs = fs.readdirSync(root).filter((entry) => {
    const full = path.join(root, entry);
    try {
      return (
        fs.statSync(full).isDirectory() &&
        fs.readdirSync(full).some((f) => f.endsWith('.json'))
      );
    } catch {
      return false;
    }
  });
  const locales = config.locales
    ? localeDirs.filter((locale) => config.locales!.includes(locale))
    : localeDirs;
  if (locales.length === 0) return null;

  const defaultLocale =
    config.defaultLocale ??
    routing.defaultLocale ??
    (locales.includes('en') ? 'en' : locales.length === 1 ? locales[0] : null);
  if (!defaultLocale || !locales.includes(defaultLocale)) return null;

  // Read every {lng}/{ns}.json into raw[locale][ns].
  const raw: Record<string, Record<string, Record<string, unknown>>> = {};
  for (const locale of locales) {
    const localeDir = path.join(root, locale);
    raw[locale] = {};
    for (const entry of fs.readdirSync(localeDir)) {
      if (!entry.endsWith('.json')) continue;
      const ns = path.basename(entry, '.json');
      const file = path.join(localeDir, entry);
      try {
        raw[locale][ns] = JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch (error) {
        throw new CatalogConversionError(
          `Could not parse i18next catalog ${path.relative(cwd, file)}: ${String(error)}. ` +
            'Fix the JSON (no comments, trailing commas, or BOM) and re-run.'
        );
      }
    }
  }

  // Collect call-site evidence so plurals/context group only where the app
  // actually passes { count } / { context }.
  const sources = readProjectSources(cwd);
  const evidence = collectCallSiteEvidence(
    sources,
    config.defaultNS,
    config.separators
  );

  const input: ConvertInput = {
    defaultLocale,
    locales,
    defaultNS: config.defaultNS,
    raw,
    separators: config.separators,
    countKeys: evidence.countKeys,
    contextKeys: evidence.contextKeys,
    defaults: evidence.defaults,
    isIcu: hasI18nextIcu(cwd),
  };
  const { byLocale, reports } = convertCatalogs(input);

  const dir = chooseOutputDir(cwd);

  return { defaultLocale, locales, byLocale, dir, reports };
}

/**
 * Serializes the converted ICU dictionaries into the new output dir and records
 * every conversion note as a report TODO. Called during the emit phase so the
 * writes flow through the driver's --dry-run-aware edit buffer.
 */
export function emitReactI18nextCatalogs(ctx: MigrationContext): FileEdit[] {
  const edits: FileEdit[] = [];
  for (const locale of ctx.catalogs.locales) {
    const tree = ctx.catalogs.byLocale[locale] ?? {};
    edits.push({
      path: path.join(ctx.catalogs.dir, `${locale}.json`),
      kind: 'write',
      content: JSON.stringify(tree, null, 2) + '\n',
    });
  }
  for (const report of ctx.catalogs.reports ?? []) {
    ctx.todos.push({
      file: path.join(ctx.catalogs.dir, `${report.key.split('/')[0]}.json`),
      reason: `catalog ${report.key}: ${report.reason}`,
    });
  }
  return edits;
}

function isLocaleRoot(dir: string): boolean {
  try {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return false;
    return fs.readdirSync(dir).some((entry) => {
      const full = path.join(dir, entry);
      try {
        return (
          fs.statSync(full).isDirectory() &&
          fs.readdirSync(full).some((f) => f.endsWith('.json'))
        );
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

function chooseOutputDir(cwd: string): string {
  for (const candidate of OUTPUT_DIR_CANDIDATES) {
    const full = path.join(cwd, candidate);
    if (!fs.existsSync(full)) return full;
  }
  // Every candidate already exists (a re-run): reuse the primary; it is our
  // own generated dir, never a user catalog dir.
  return path.join(cwd, OUTPUT_DIR_CANDIDATES[0]);
}

function hasI18nextIcu(cwd: string): boolean {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(cwd, 'package.json'), 'utf8')
    );
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    return Boolean(deps['i18next-icu']);
  } catch {
    return false;
  }
}

function readProjectSources(cwd: string): { file: string; code: string }[] {
  const files = matchFiles(cwd, [
    '**/*.{js,jsx,ts,tsx}',
    '!**/node_modules/**',
    '!**/.next/**',
    '!**/dist/**',
    '!**/build/**',
    '!**/out/**',
    '!**/coverage/**',
  ]);
  const sources: { file: string; code: string }[] = [];
  for (const file of files) {
    try {
      sources.push({ file, code: fs.readFileSync(file, 'utf8') });
    } catch {
      // unreadable file: skip; evidence is best-effort
    }
  }
  return sources;
}
