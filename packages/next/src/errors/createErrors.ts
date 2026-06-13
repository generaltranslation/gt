// ---- ERRORS ---- //

import { getLocaleProperties } from '@generaltranslation/format';
import {
  createGtNextDiagnostic,
  createGtNextPluginDiagnostic,
  formatDiagnosticErrorDetails,
} from './diagnostics';
import { BABEL_PLUGIN_SUPPORT, SWC_PLUGIN_SUPPORT } from '../plugin/constants';

export const remoteTranslationsError = createGtNextDiagnostic({
  severity: 'Error',
  whatHappened: 'Remote translations could not be loaded',
  fix: 'Check your project ID, API key, and network connection, then try again',
  wayOut: 'Source content will render as a fallback',
});

export const customLoadTranslationsError = (locale: string = '') =>
  createGtNextDiagnostic({
    severity: 'Error',
    whatHappened: `Locally stored translations could not be loaded${locale ? ` for "${locale}"` : ''}`,
    fix: 'If you use loadTranslations(), make sure it returns translations for the requested locale',
  });

export const customLoadDictionaryWarning = (locale: string = '') =>
  createGtNextDiagnostic({
    severity: 'Warning',
    whatHappened: `The local dictionary could not be loaded${locale ? ` for "${locale}"` : ''}`,
    fix: 'If you use loadDictionary(), make sure it returns a dictionary for the requested locale',
  });

export const createUnresolvedNextVersionError = (error: Error) =>
  createGtNextDiagnostic({
    severity: 'Error',
    whatHappened: 'The installed Next.js version could not be resolved',
    fix: 'Check that next is installed in this project',
    details: error.message,
  });

export const createUnresolvedReactVersionError = (error: Error) =>
  createGtNextDiagnostic({
    severity: 'Error',
    whatHappened: 'The installed React version could not be resolved',
    fix: 'Check that react is installed in this project',
    details: error.message,
  });

export const createStringTranslationError = (
  string: string,
  id?: string,
  functionName = 'tx'
) =>
  createGtNextDiagnostic({
    severity: 'Error',
    whatHappened: `${functionName}("${string}")${id ? ` with id "${id}"` : ''} could not find a translation`,
    wayOut: 'Source content will render as a fallback',
    fix: 'Push translations again or check your dictionary/runtime translation configuration',
  });

export const createDictionaryTranslationError = (id: string) =>
  createGtNextDiagnostic({
    severity: 'Error',
    whatHappened: `Dictionary translation entry "${id}" could not be found`,
    fix: 'Check that the id exists in your dictionary or push translations again',
  });

export const createRequiredPrefixError = (id: string, requiredPrefix: string) =>
  createGtNextDiagnostic({
    severity: 'Error',
    whatHappened: `<GTProvider> is scoped to prefix "${requiredPrefix}", but a child uses id "${id}"`,
    fix: 'Change the <GTProvider> id prop or move the child under the matching dictionary subtree',
  });

export const devApiKeyIncludedInProductionError = createGtNextDiagnostic({
  severity: 'Error',
  whatHappened: 'Production builds cannot use a development API key',
  fix: 'Replace it with a production API key',
});

export const createDictionarySubsetError = (id: string, functionName: string) =>
  createGtNextDiagnostic({
    severity: 'Error',
    whatHappened: `${functionName} with id "${id}" could not read a valid dictionary subtree`,
    fix: 'Make sure the id maps to the correct subroute of the dictionary',
  });

export const dictionaryDisabledError = createGtNextDiagnostic({
  severity: 'Error',
  whatHappened: 'Dictionaries are not enabled',
  fix: 'Add the withGTConfig() plugin to your Next.js config before using dictionary translations',
  docsUrl: 'https://generaltranslation.com/docs',
});

export const unresolvedCustomLoadDictionaryError = createGtNextDiagnostic({
  severity: 'Error',
  whatHappened:
    'loadDictionary() was found during the build but could not be resolved at runtime',
  fix: 'Export a loadDictionary() function from the configured file',
});

export const unresolvedCustomLoadTranslationsError = createGtNextDiagnostic({
  severity: 'Error',
  whatHappened:
    'loadTranslations() was found during the build but could not be resolved at runtime',
  fix: 'Export a loadTranslations() function from the configured file',
});

export const unresolvedLoadDictionaryBuildError = (path: string) =>
  createGtNextDiagnostic({
    severity: 'Error',
    whatHappened: `The file defining loadDictionary() could not be resolved at ${path}`,
    fix: 'Check the configured path and try again',
  });

export const unresolvedLoadTranslationsBuildError = (path: string) =>
  createGtNextDiagnostic({
    severity: 'Error',
    whatHappened: `The file defining loadTranslations() could not be resolved at ${path}`,
    fix: 'Check the configured path and try again',
  });

export const unresolvedGetLocaleBuildError = (path: string) =>
  createGtNextDiagnostic({
    severity: 'Error',
    whatHappened: `The file defining custom getLocale() could not be resolved at ${path}`,
    fix: 'Check the configured path and try again',
  });

export const conflictingConfigurationBuildError = (conflicts: string[]) =>
  `gt-next Error: Conflicting configuration${
    conflicts.length > 1 ? 's' : ''
  } detected. Resolve the following conflicts before building your app:\n${conflicts.join(
    '\n'
  )}`;

export const typesFileError = createGtNextDiagnostic({
  severity: 'Error',
  whatHappened: 'A types-only entry point was executed at runtime',
  fix: 'Import from the appropriate gt-next runtime entry point instead',
});

export const clientEntrypointImportedOnServerError = createGtNextDiagnostic({
  severity: 'Error',
  whatHappened: 'The gt-next client entry point was imported on the server',
  fix: "Import from 'gt-next/server' or 'gt-next' from server components",
});

export const serverEntrypointImportedInBrowserError = createGtNextDiagnostic({
  severity: 'Error',
  whatHappened: 'The gt-next server entry point was imported in the browser',
  fix: "Import from 'gt-next/client' from client components",
});

export const rscEntrypointImportedInBrowserError = createGtNextDiagnostic({
  severity: 'Error',
  whatHappened: 'The gt-next RSC entry point was imported in the browser',
  fix: "Import from 'gt-next/client' from client components",
});

export const getTranslationsSnapshotRscError = createGtNextDiagnostic({
  severity: 'Error',
  whatHappened:
    'getTranslationsSnapshot() is not available for React Server Components',
  fix: 'Use gt-next build-time translation helpers in the App Router, or call getTranslationsSnapshot() from a Pages Router entry point',
});

export const gtProviderUseClientError =
  `The Next.js <GTProvider> was imported in a client component. This prevents gt-next from fetching translations on the server. ` +
  `Move <GTProvider> to a file without 'use client'. ` +
  `If you really need to put <GTProvider> on the client, import <GTClientProvider> from 'gt-next/client' instead (discouraged when using the Next.js App Router).`;

export const txUseClientError =
  `The <Tx> runtime translation component was rendered in a client component, which is not supported. ` +
  `Use <T> with variables, or render <Tx> from a server component.`;

export const missingVariablesError = (variables: string[], message: string) =>
  createGtNextDiagnostic({
    severity: 'Error',
    whatHappened: `The message "${message}" is missing variables: "${variables.join('", "')}"`,
    fix: 'Provide values for these variables before rendering the translation',
  });

export const createStringRenderError = (
  message: string,
  id: string | undefined,
  error?: unknown
) =>
  createGtNextDiagnostic({
    severity: 'Error',
    whatHappened: `The string ${id ? `for id "${id}" ` : ''}could not be rendered`,
    fix: `Check the message syntax and variables for: "${message}"`,
    details: formatDiagnosticErrorDetails(error),
  });

export const invalidLocalesError = (locales: string[]) =>
  createGtNextDiagnostic({
    severity: 'Error',
    whatHappened: 'Invalid locale codes in your configuration',
    fix: 'Specify a list of valid locales or use "customMapping" to define aliases for the invalid locales',
    details: locales,
  });

export const invalidCanonicalLocalesError = (locales: string[]) =>
  createGtNextDiagnostic({
    severity: 'Error',
    whatHappened: 'Invalid canonical locale codes in your configuration',
    fix: 'Use valid BCP 47 locale codes before starting translation',
    details: locales,
  });

export const createInvalidIcuDictionaryEntryError = (id: string) =>
  createGtNextDiagnostic({
    severity: 'Error',
    whatHappened: `Dictionary entry "${id}" contains invalid ICU syntax`,
    fix: 'Fix the ICU message before rendering this translation',
  });

// ---- WARNINGS ---- //

export const createInvalidIcuDictionaryEntryWarning = (id: string) =>
  createGtNextDiagnostic({
    whatHappened: `Dictionary entry "${id}" contains invalid ICU syntax`,
    wayOut: 'Source content will render as a fallback until the entry is fixed',
  });

export const createBadFilepathWarning = (filename: string, dir: string[]) =>
  createGtNextDiagnostic({
    whatHappened: `${filename} was found in ${dir.join(' or ')}, which is not supported`,
    fix: 'Move it to your project root so gt-next can load it',
  });

export const usingDefaultsWarning = createGtNextDiagnostic({
  whatHappened: 'The gt-next configuration could not be loaded',
  wayOut: 'Defaults will be used',
  fix: 'Check your config path if this was unexpected',
});

export const createNoEntryFoundWarning = (id: string) =>
  createGtNextDiagnostic({
    whatHappened: `No valid dictionary entry was found for id "${id}"`,
    wayOut: 'Source content will render as a fallback',
  });

export const createInvalidDictionaryEntryWarning = (id: string) =>
  createGtNextDiagnostic({
    whatHappened: `Dictionary entry "${id}" is invalid`,
    wayOut: 'Source content will render as a fallback until the entry is fixed',
  });

export const createInvalidDictionaryTranslationEntryWarning = (id: string) =>
  createGtNextDiagnostic({
    whatHappened: `Dictionary translation entry "${id}" is invalid`,
    wayOut: 'Source content will render as a fallback until the entry is fixed',
  });

export const createUnsupportedLocalesWarning = (locales: string[]) =>
  `gt-next: The following locales are currently unsupported by our service: ${locales
    .map((locale) => {
      const { name } = getLocaleProperties(locale);
      return `${locale} (${name})`;
    })
    .join(', ')}`;

export const createMismatchingHashWarning = (
  expectedHash: string,
  receivedHash: string
) =>
  createGtNextDiagnostic({
    whatHappened: 'Translation hashes do not match',
    reassurance: 'The translation will still render',
    fix: 'Update your translations to the newest version to avoid stale content',
    details: [`expected ${expectedHash}`, `received ${receivedHash}`],
  });

export const projectIdMissingWarn = createGtNextDiagnostic({
  whatHappened: 'Runtime translation needs a project ID',
  fix: 'Set GT_PROJECT_ID in your environment or pass projectId to withGTConfig()',
  docsUrl: 'https://generaltranslation.com/dashboard',
});

export const noInitGTWarn =
  `gt-next: You are running General Translation without the withGTConfig() plugin. ` +
  `This means that you are not translating your app. To activate translation, add the withGTConfig() plugin to your app, ` +
  `and set the projectId and apiKey in your environment. ` +
  `For more information, visit https://generaltranslation.com/docs/next/tutorials/quickstart`;

export const APIKeyMissingWarn = createGtNextPluginDiagnostic({
  whatHappened: 'Runtime translation needs a development API key',
  fix: 'Find your development API key at generaltranslation.com/dashboard, or set runtimeUrl to an empty string to disable runtime translation',
});

export const createTranslationLoadingWarning = ({
  source,
  translation,
  id,
}: {
  source: string;
  translation: string;
  id?: string;
}) =>
  `[DEV ONLY] Warning: gt-next created translation "${source}" -> "${translation}"` +
  (id ? ` for id "${id}"` : '') +
  `. ` +
  `In development, hot-reloaded translations may not be be displayed until the page is refreshed. ` +
  `In production, translations will be preloaded and there won't be a warning.`;

export const runtimeTranslationTimeoutWarning = createGtNextDiagnostic({
  whatHappened: 'Runtime translation timed out',
});

export const dictionaryNotFoundWarning = createGtNextDiagnostic({
  whatHappened: 'No dictionary was found',
  fix: 'Add dictionary.js or [defaultLocale].json to your project, and make sure withGTConfig() is enabled',
});

export const standardizedLocalesWarning = (locales: string[]) =>
  `gt-next: The following locales were standardized: ${locales.join(', ')}. Use the standardized codes in your config to avoid this warning.`;

export const standardizedCanonicalLocalesWarning = (locales: string[]) =>
  `gt-next: The following canonical locales were standardized: ${locales.join(', ')}. Use the standardized codes in your config to avoid this warning.`;

export const createGTCompilerUnresolvedWarning = (type: 'babel' | 'swc') =>
  `gt-next (plugin): The GT ${type} compiler could not be resolved. Skipping compiler optimizations.`;

export const customGetLocaleUnresolvedWarning = createGtNextDiagnostic({
  whatHappened: 'Custom getLocale() could not be resolved',
  wayOut: 'gt-next will fall back to default locale detection',
  fix: 'Export a getLocale() function from the configured request file',
});

export const createGTCompilerUnavailableWarning = (type: 'babel' | 'swc') =>
  type === 'swc'
    ? `gt-next (plugin): The GT swc compiler is compatible with < next@${SWC_PLUGIN_SUPPORT}. Skipping compiler optimizations.`
    : `gt-next (plugin): The GT babel compiler requires react@${BABEL_PLUGIN_SUPPORT} or newer. Skipping compiler optimizations.`;

export const babelCompilerTurbopackUnavailableWarning =
  `gt-next (plugin): The GT babel compiler is not compatible with Turbopack. ` +
  `To use compiler optimizations with Turbopack, set experimentalCompilerOptions: { type: 'swc' }.`;

export const disablingCompileTimeHashWarning = `gt-next (plugin): Compile-time hash is disabled. Compiler optimizations are inactive.`;

export const createStringRenderWarning = (
  message: string,
  id: string | undefined,
  error?: unknown
) =>
  createGtNextDiagnostic({
    whatHappened: `The string ${id ? `for id "${id}" ` : ''}could not be rendered`,
    wayOut: 'Source content will render as a fallback',
    fix: `Check the message syntax and variables for: "${message}"`,
    details: formatDiagnosticErrorDetails(error),
  });

export const swcPluginCompatibilityChangeWarning = `gt-next (plugin): As of gt-next@6.12.4, SWC plugin support is disabled for Next.js versions prior to ${SWC_PLUGIN_SUPPORT}. Update to the latest version of Next.js.`;
