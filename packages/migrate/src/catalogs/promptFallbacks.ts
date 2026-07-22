import fs from 'node:fs';
import path from 'node:path';
import {
  createDiagnosticMessage,
  libraryDefaultLocale,
} from 'generaltranslation/internal';
import { loadCatalog } from './discover.js';
import type { MigrateIO } from '../pipeline/io.js';
import type { MessageCatalogs, RoutingInfo } from '../pipeline/types.js';

/**
 * Interactive fallback for `gt migrate` when catalog detection comes up empty.
 * Parsing stays primary; this only runs when discoverCatalogs returns null.
 * Asks the user directly (the same prompt building blocks `gt setup` uses)
 * for the catalog directory, the supported locales, and the default locale
 * instead of guessing.
 *
 * Returns null (falling through to the driver's standard hard error) when the
 * session is non-interactive, or when the answers do not describe a loadable
 * catalog set, so CI and piped runs keep today's behavior.
 */
export async function resolveCatalogsInteractively(
  cwd: string,
  routing: RoutingInfo,
  io: MigrateIO
): Promise<MessageCatalogs | null> {
  // Non-interactive (CI, piped input): no one to answer, keep the hard error.
  // Gate on stdin: it is the stream the prompts read, and it stays a TTY when
  // only the output is piped (`gt migrate ... | tee log`).
  if (!process.stdin.isTTY) return null;

  io.warn(
    createDiagnosticMessage({
      whatHappened:
        'Could not automatically locate your next-intl message catalogs',
      fix: 'Answer a few questions and we will pick them up from there.',
    })
  );

  const validateDir = catalogDirValidator(cwd);
  const dirInput = await io.promptText({
    message:
      'Where are your translation files? (directory path relative to the project root)',
    defaultValue: routing.requestFile ? undefined : 'messages',
    validate: validateDir,
  });
  // Re-check: the prompt utilities can resolve to an empty string (a cancelled
  // ink prompt), which bypasses the validator above.
  if (validateDir(dirInput) !== true) return null;
  const dir = path.resolve(cwd, dirInput.trim());

  // The validator guarantees at least one .json in the chosen directory, so
  // the stems always give the seed.
  const stems = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => path.basename(file, '.json'));

  const locales = await io.promptLocaleList({
    message: 'Which locales should be migrated?',
    defaultValue: stems,
  });
  if (locales.length === 0) return null;

  const defaultSeed =
    routing.defaultLocale ??
    (locales.includes(libraryDefaultLocale)
      ? libraryDefaultLocale
      : locales[0]);
  const defaultLocale = await io.promptLocale({
    message: 'Which locale is the source (default) locale?',
    defaultValue: defaultSeed,
  });

  if (!locales.includes(defaultLocale)) {
    io.error(
      createDiagnosticMessage({
        whatHappened: `Default locale '${defaultLocale}' is not one of the selected locales [${locales.join(', ')}]`,
        fix: 'Pick a default locale that is in the selected list and re-run.',
      })
    );
    return null;
  }

  for (const locale of locales) {
    const file = path.join(dir, `${locale}.json`);
    if (!fs.existsSync(file)) {
      io.error(
        createDiagnosticMessage({
          whatHappened: `No catalog file found for '${locale}', expected ${file}`,
          fix: `Add that file, or remove '${locale}' from the selected locales, then re-run.`,
        })
      );
      return null;
    }
  }

  const byLocale: Record<string, Record<string, unknown>> = {};
  for (const locale of locales) {
    byLocale[locale] = loadCatalog(dir, locale);
  }

  return { defaultLocale, locales, byLocale, dir };
}

/**
 * Validator for the catalog directory prompt: the path (relative to cwd) must
 * exist, be a directory, and hold at least one JSON catalog. Returns true when
 * valid, otherwise a message the prompt shows before re-asking.
 */
function catalogDirValidator(cwd: string) {
  return (value: string): boolean | string => {
    const trimmed = value.trim();
    if (!trimmed) return 'Enter a directory path';
    const abs = path.resolve(cwd, trimmed);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
      return `No such directory: ${trimmed}`;
    }
    if (!fs.readdirSync(abs).some((file) => file.endsWith('.json'))) {
      return `No .json catalogs in ${trimmed}`;
    }
    return true;
  };
}
