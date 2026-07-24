import fs from 'node:fs';
import path from 'node:path';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import {
  createMigrateDiagnostic,
  formatDiagnosticErrorDetails,
} from '../pipeline/diagnostics.js';
import type { MigrateIO } from '../pipeline/io.js';
import type { MessageCatalogs, RoutingInfo } from '../pipeline/types.js';

const DEFAULT_CATALOG_DIRS = ['messages', 'src/messages', 'locales'];

/**
 * Locates the project's next-intl message catalogs and loads every locale
 * file. Returns null when no catalog directory can be found or when the
 * default locale cannot be determined.
 */
export async function discoverCatalogs(
  cwd: string,
  routing: RoutingInfo,
  io?: MigrateIO
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
  // A routing config that names locales with no catalog file here would
  // silently migrate a narrower locale set than configured. Bail so the driver
  // falls through to the interactive prompt instead of dropping them quietly.
  if (routing.locales) {
    const missing = routing.locales.filter((locale) => !stems.includes(locale));
    if (missing.length > 0) {
      io?.warn(
        createMigrateDiagnostic({
          severity: 'Warning',
          whatHappened: `Your next-intl routing config lists locales with no catalog file in ${dir}`,
          details: `no catalog for ${missing.join(', ')}`,
          fix: `Add the missing ${missing
            .map((locale) => `${locale}.json`)
            .join(
              ', '
            )} to ${dir}, or update the routing config's locales to match the catalogs present.`,
          wayOut:
            'In an interactive run, gt migrate asks for the directory and locales next.',
        })
      );
      return null;
    }
  }
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
      createMigrateDiagnostic({
        severity: 'Error',
        whatHappened: `Could not parse message catalog ${file}`,
        fix: 'Fix the JSON (no comments, trailing commas, or BOM) and re-run.',
        details: formatDiagnosticErrorDetails(error),
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
