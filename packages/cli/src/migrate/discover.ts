import fs from 'node:fs';
import path from 'node:path';
import {
  createDiagnosticMessage,
  libraryDefaultLocale,
} from 'generaltranslation/internal';
import type { MessageCatalogs, RoutingInfo } from './types.js';

const DEFAULT_CATALOG_DIRS = ['messages', 'src/messages', 'locales'];

/**
 * Locates the project's next-intl message catalogs and loads every locale
 * file. Returns null when no catalog directory can be found or when the
 * default locale cannot be determined.
 */
export async function discoverCatalogs(
  cwd: string,
  routing: RoutingInfo
): Promise<MessageCatalogs | null> {
  const candidates: string[] = [];
  const requestDir = catalogDirFromRequestFile(routing.requestFile);
  if (requestDir) candidates.push(requestDir);
  for (const dir of DEFAULT_CATALOG_DIRS) {
    candidates.push(path.join(cwd, dir));
  }

  const dir = candidates.find(
    (candidate) =>
      fs.existsSync(candidate) &&
      fs.statSync(candidate).isDirectory() &&
      fs.readdirSync(candidate).some((file) => file.endsWith('.json'))
  );
  if (!dir) return null;

  const stems = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => path.basename(file, '.json'));
  const locales = routing.locales
    ? stems.filter((stem) => routing.locales!.includes(stem))
    : stems;
  if (locales.length === 0) return null;

  const defaultLocale =
    routing.defaultLocale ??
    (locales.includes(libraryDefaultLocale)
      ? libraryDefaultLocale
      : locales.length === 1
        ? locales[0]
        : null);
  if (!defaultLocale || !locales.includes(defaultLocale)) return null;

  const byLocale: Record<string, Record<string, unknown>> = {};
  for (const locale of locales) {
    byLocale[locale] = loadCatalog(dir, locale);
  }

  return { defaultLocale, locales, byLocale, dir };
}

/**
 * Reads and parses a single locale catalog. Shared with the interactive
 * fallback (promptFallbacks.ts) so both paths surface the identical
 * diagnostic when a catalog is malformed. Throws (the migrate driver catches
 * and exits before anything is written).
 */
export function loadCatalog(
  dir: string,
  locale: string
): Record<string, unknown> {
  const file = path.join(dir, `${locale}.json`);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(
      createDiagnosticMessage({
        whatHappened: `Could not parse message catalog ${file}: ${String(error)}`,
        fix: 'Fix the JSON (no comments, trailing commas, or BOM) and re-run.',
      })
    );
  }
}

/**
 * next-intl request configs conventionally load catalogs with a dynamic
 * import like `import(`../../messages/${locale}.json`)`; resolve that
 * template's directory relative to the request file.
 */
function catalogDirFromRequestFile(requestFile: string | null): string | null {
  if (!requestFile || !fs.existsSync(requestFile)) return null;
  const source = fs.readFileSync(requestFile, 'utf8');
  const match = source.match(
    /import\(\s*`([^`]*?)\$\{[A-Za-z_$][\w$]*\}[^`]*\.json`\s*\)/
  );
  if (!match) return null;
  const prefix = match[1];
  const dirPart = prefix.endsWith('/')
    ? prefix.slice(0, -1)
    : path.dirname(prefix);
  return path.resolve(path.dirname(requestFile), dirPart);
}
