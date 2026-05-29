import {
  createGtNextDiagnostic,
  formatDiagnosticErrorDetails,
} from './diagnostics';

// ---- ERRORS ---- //
export const cacheComponentsLegacySsgConflictError = createGtNextDiagnostic({
  severity: 'Error',
  whatHappened:
    'experimentalLocaleResolution and deprecated experimentalEnableSSG are both enabled',
  fix: 'Disable one of them before building your app',
});

export const createExperimentalLocaleResolutionError = (error: unknown) =>
  createGtNextDiagnostic({
    whatHappened: 'Locale resolution with experimentalLocaleResolution failed',
    wayOut: 'gt-next will fall back where possible',
    details: formatDiagnosticErrorDetails(error),
  });

// ---- WARNINGS ---- //
export type CacheComponentsRequestFunction = 'getLocale' | 'getRegion';

export const createCacheComponentsMissingRequestFunctionsWarning = (
  requestFunctions: CacheComponentsRequestFunction[]
) => {
  const isPlural = requestFunctions.length > 1;
  const functionNames = requestFunctions
    .map((requestFunction) => `${requestFunction}()`)
    .join(' and ');
  const fileNames = requestFunctions
    .map((requestFunction) => `${requestFunction}.ts`)
    .join(' and ');
  const configKeys = requestFunctions
    .map((requestFunction) => `${requestFunction}Path`)
    .join(' and ');

  return createGtNextDiagnostic({
    whatHappened: `cacheComponents is enabled, but custom ${functionNames} ${isPlural ? 'are' : 'is'} not configured`,
    wayOut:
      'Automatic root parameter detection is deprecated because it relies on unsupported Next.js internals',
    fix: `Add ${fileNames} ${isPlural ? 'files' : 'file'}, or configure ${configKeys}`,
  });
};

export const experimentalLocaleResolutionDeprecatedWarning =
  createGtNextDiagnostic({
    severity: 'Warning',
    whatHappened: 'experimentalLocaleResolution is deprecated',
    wayOut:
      'This option relies on unsupported Next.js internals and may break in future Next.js releases',
    fix: 'Remove experimentalLocaleResolution and define custom getLocale.ts and getRegion.ts files for cacheComponents support',
  });

export const cacheComponentsExperimentalFeatureDisableGetRequestFunctionWarning =
  'gt-next: experimentalLocaleResolution is enabled. getRegion and getDomain are disabled.';

export const cacheComponentsExperimentalLocaleResolutionDisableCustomGetLocaleWarning =
  'gt-next: experimentalLocaleResolution is enabled. The provided getLocale function will be ignored.';

export const cacheComponentsNonLocalTranslationsWarning =
  createGtNextDiagnostic({
    severity: 'Warning',
    whatHappened:
      'cacheComponents is enabled, but translations are not stored locally',
    wayOut: 'Prerendering may fail',
    fix: 'Store translations locally before building cached pages',
    docsUrl: 'https://generaltranslation.com/en-US/docs/next/guides/local-tx',
  });

export const experimentalLocaleResolutionWithoutCacheComponentsWarning =
  'gt-next: experimentalLocaleResolution is enabled, but cacheComponents is disabled. experimentalLocaleResolution is deprecated and should be removed.';
