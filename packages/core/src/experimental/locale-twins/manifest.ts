import { formatDiagnosticErrorDetails } from '../../logging/diagnostics';
import { LOCALE_TWIN_MANIFEST_VERSION } from './constants';
import { createLocaleTwinDiagnostic } from './diagnostics';

/**
 * The twin manifest: the build artifact that maps every twinned chunk to its
 * twin in each locale. Written by the build, read by serving helpers.
 * File names are POSIX paths relative to the client output directory.
 */
export type LocaleTwinManifest = {
  version: typeof LOCALE_TWIN_MANIFEST_VERSION;
  defaultLocale: string;
  /** Every locale with twins, including the default locale. */
  locales: string[];
  /** Original file names of every twinned chunk. */
  twinned: string[];
  /** Original file names of twinned entry chunks. */
  entries: string[];
  /** Per-locale version token embedded in that locale's twin file names. */
  versions: Record<string, string>;
  /** `twins[locale][originalFileName]` is that file's twin in `locale`. */
  twins: Record<string, Record<string, string>>;
};

/**
 * Validates a twin manifest given as JSON text or an already-parsed value.
 * Throws a diagnostic error for unknown or missing versions and for values
 * that do not have the manifest's shape.
 */
export function parseLocaleTwinManifest(json: unknown): LocaleTwinManifest {
  let value = json;
  if (typeof json === 'string') {
    try {
      value = JSON.parse(json);
    } catch (error) {
      throw invalidManifestError(
        'it is not valid JSON',
        formatDiagnosticErrorDetails(error)
      );
    }
  }
  if (!isRecord(value)) {
    throw invalidManifestError('it is not an object');
  }
  if (value.version !== LOCALE_TWIN_MANIFEST_VERSION) {
    throw unsupportedVersionError(value.version);
  }
  const problem = findShapeProblem(value);
  if (problem) throw invalidManifestError(problem);
  return value as LocaleTwinManifest;
}

function findShapeProblem(value: Record<string, unknown>): string | undefined {
  const { defaultLocale, locales, twinned, entries, versions, twins } = value;
  if (typeof defaultLocale !== 'string' || !defaultLocale) {
    return 'defaultLocale is not a locale string';
  }
  if (!isStringArray(locales)) return 'locales is not a list of strings';
  if (!locales.includes(defaultLocale)) {
    return 'locales does not include defaultLocale';
  }
  if (!isStringArray(twinned)) return 'twinned is not a list of file names';
  if (!isStringArray(entries)) return 'entries is not a list of file names';
  if (!isStringRecord(versions)) {
    return 'versions does not map locales to version strings';
  }
  if (
    !isRecord(twins) ||
    !Object.values(twins).every((fileMap) => isStringRecord(fileMap))
  ) {
    return 'twins does not map locales to file name maps';
  }
  return undefined;
}

function unsupportedVersionError(version: unknown): Error {
  return new Error(
    createLocaleTwinDiagnostic({
      severity: 'Error',
      whatHappened:
        version === undefined
          ? 'The locale twin manifest has no format version'
          : `The locale twin manifest has format version ${JSON.stringify(version)}`,
      why: `this version of generaltranslation reads version ${LOCALE_TWIN_MANIFEST_VERSION} only`,
      fix: 'Rebuild the app with the same GT package versions that serve it',
    })
  );
}

function invalidManifestError(why: string, details?: string): Error {
  return new Error(
    createLocaleTwinDiagnostic({
      severity: 'Error',
      whatHappened: 'The locale twin manifest could not be read',
      why,
      fix: 'Rebuild the app so the build writes a fresh manifest',
      details,
    })
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    isRecord(value) &&
    Object.values(value).every((item) => typeof item === 'string')
  );
}
