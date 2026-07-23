// ---- ERRORS ---- //

import {
  createGtNextDiagnostic,
  createGtNextPluginDiagnostic,
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

export const getTranslationsSnapshotRscError = createGtNextDiagnostic({
  severity: 'Error',
  whatHappened:
    'getTranslationsSnapshot() is not available for React Server Components',
  fix: 'Use gt-next build-time translation helpers in the App Router, or call getTranslationsSnapshot() from a Pages Router entry point',
});

export const withGTStaticPropsRscError = createGtNextDiagnostic({
  severity: 'Error',
  whatHappened:
    'withGTStaticProps() is not available for React Server Components',
  why: 'This helper supports the Pages Router, not the App Router',
  fix: 'Use gt-next build-time translation helpers in the App Router, or export withGTStaticProps() from a Pages Router page module',
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

// ---- WARNINGS ---- //

export const createBadFilepathWarning = (filename: string, dir: string[]) =>
  createGtNextDiagnostic({
    whatHappened: `${filename} was found in ${dir.join(' or ')}, which is not supported`,
    fix: 'Move it to your project root so gt-next can load it',
  });

export const projectIdMissingWarn = createGtNextDiagnostic({
  whatHappened: 'Runtime translation needs a project ID',
  fix: 'Set GT_PROJECT_ID in your environment or pass projectId to withGTConfig()',
  docsUrl: 'https://generaltranslation.com/dashboard',
});

export const APIKeyMissingWarn = createGtNextPluginDiagnostic({
  whatHappened: 'Runtime translation needs a development API key',
  fix: 'Find your development API key at generaltranslation.com/dashboard, or set runtimeUrl to an empty string to disable runtime translation',
});

export const standardizedLocalesWarning = (locales: string[]) =>
  `gt-next: The following locales were standardized: ${locales.join(', ')}. Use the standardized codes in your config to avoid this warning.`;

export const standardizedCanonicalLocalesWarning = (locales: string[]) =>
  `gt-next: The following canonical locales were standardized: ${locales.join(', ')}. Use the standardized codes in your config to avoid this warning.`;

export const createGTCompilerUnresolvedWarning = (type: 'babel' | 'swc') =>
  createGtNextPluginDiagnostic({
    whatHappened: `The GT ${type} compiler could not be resolved`,
    wayOut: 'Skipping compiler optimizations',
    ...(type === 'babel' && {
      fix: 'Install @generaltranslation/compiler to enable the experimental babel compiler',
    }),
  });

export const autoJsxInjectionCompilerWarning = createGtNextPluginDiagnostic({
  severity: 'Warning',
  whatHappened: 'Automatic JSX injection requires the GT webpack compiler',
  wayOut: 'Automatic JSX injection will be skipped',
  fix: "Set experimentalCompilerOptions.type to 'babel' in withGTConfig() and build with webpack",
});

export const customGetLocaleUnresolvedWarning = createGtNextDiagnostic({
  whatHappened: 'Custom getLocale() could not be resolved',
  wayOut: 'gt-next will fall back to default locale detection',
  fix: 'Export a getLocale() function from the configured request file',
});

export const customGetRegionUnresolvedWarning = createGtNextDiagnostic({
  whatHappened: 'Custom getRegion() could not be resolved',
  wayOut: 'gt-next will fall back to default region detection',
  fix: 'Export a getRegion() function from the configured request file',
});

export const createGTCompilerUnavailableWarning = (type: 'babel' | 'swc') =>
  type === 'swc'
    ? `gt-next (plugin): The GT swc compiler is compatible with < next@${SWC_PLUGIN_SUPPORT}. Skipping compiler optimizations.`
    : `gt-next (plugin): The GT babel compiler requires react@${BABEL_PLUGIN_SUPPORT} or newer. Skipping compiler optimizations.`;

export const babelCompilerTurbopackUnavailableWarning =
  `gt-next (plugin): The GT babel compiler is not compatible with Turbopack. ` +
  `To use compiler optimizations with Turbopack, set experimentalCompilerOptions: { type: 'swc' }.`;

export const disablingCompileTimeHashWarning = `gt-next (plugin): Compile-time hash is disabled. Compiler optimizations are inactive.`;

export const swcPluginCompatibilityChangeWarning = `gt-next (plugin): As of gt-next@6.12.4, SWC plugin support is disabled for Next.js versions prior to ${SWC_PLUGIN_SUPPORT}. Update to the latest version of Next.js.`;
