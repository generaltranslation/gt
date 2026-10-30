import fs from 'fs';
import {
  couldNotLocateConfigWarning,
  invalidLocalesWarning,
  resolveLocalesFailedWarning,
} from '../../errors-dir/warnings';
import { libraryDefaultLocale } from 'generaltranslation/internal';
import { getSupportedLocale } from '@generaltranslation/supported-locales';
import path from 'path';
import { safeParse } from 'valibot';
import {
  GTConfigSchema,
  describeConfigIssues,
  describeConfigParseError,
} from 'generaltranslation/config-schema';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import { PACKAGE_NAME } from '../../errors-dir/constants';

const DEFAULT_CONFIG_FILE_PATHS = [
  path.join(process.cwd(), 'gt.config.json'),
  path.join(process.cwd(), '.locadex', 'gt.config.json'),
];

/**
 * Given a list of locales or a config object or a path to a config file, return a list of locales to polyfill.
 * Preference order: locales > config > configFilePaths > library default locale
 */
export function resolveLocales({
  locales,
  config,
  configFilePath,
}: {
  locales?: string[];
  config?: { defaultLocale: string; locales: string[] } & Record<
    string,
    unknown
  >;
  configFilePath?: string;
}): string[] {
  let result: string[] = [];

  // Resolve locales from the given options
  if (locales) {
    result = Array.from(new Set(locales));
  } else if (config) {
    result = Array.from(new Set([config.defaultLocale, ...config.locales]));
  } else {
    result = resolveLocalesFromConfig(configFilePath);
  }

  // Validate the result
  const invalidLocales = result.filter((locale) => !getSupportedLocale(locale));
  if (invalidLocales.length) {
    console.warn(invalidLocalesWarning(invalidLocales));
    result = result.filter((locale) => !invalidLocales.includes(locale));
  }

  // Fallback to default locale if no locales were found
  if (result.length === 0) {
    console.warn(resolveLocalesFailedWarning);
    result = [libraryDefaultLocale];
  }

  return result;
}

/**
 * Resolve locales from a config file
 * @param configFilePath - The path to the config file
 * @returns A list of locales
 */
function resolveLocalesFromConfig(configFilePath: string | undefined) {
  const configFilePaths = [
    ...(configFilePath ? [configFilePath] : []),
    ...DEFAULT_CONFIG_FILE_PATHS,
  ];
  let result: string[] = [];

  for (const filePath of configFilePaths) {
    try {
      if (!fs.existsSync(filePath)) {
        console.warn(couldNotLocateConfigWarning(filePath));
        continue;
      }

      const parsed = safeParse(
        GTConfigSchema,
        JSON.parse(fs.readFileSync(filePath, 'utf8'))
      );
      if (!parsed.success) {
        console.error(
          createDiagnosticMessage({
            source: PACKAGE_NAME,
            severity: 'Error',
            ...describeConfigIssues(parsed.issues, filePath),
          })
        );
        break;
      }
      const resolvedConfig = parsed.output;

      result = Array.from(
        new Set([
          ...(resolvedConfig.defaultLocale
            ? [resolvedConfig.defaultLocale]
            : []),
          ...(resolvedConfig.locales || []),
        ])
      );
      break;
    } catch (error) {
      console.error(
        createDiagnosticMessage({
          source: PACKAGE_NAME,
          severity: 'Error',
          ...describeConfigParseError(error, filePath),
        })
      );
      break;
    }
  }
  return result;
}
