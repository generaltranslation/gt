import { createGtNextDiagnostic } from './diagnostics';

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
      'cacheComponents requires explicit request functions because request values cannot be inferred safely during prerendering',
    fix: `Add ${fileNames} ${isPlural ? 'files' : 'file'}, or configure ${configKeys}`,
  });
};

export const cacheComponentsNonLocalTranslationsWarning =
  createGtNextDiagnostic({
    severity: 'Warning',
    whatHappened:
      'cacheComponents is enabled, but translations are not stored locally',
    wayOut: 'Prerendering may fail',
    fix: 'Store translations locally before building cached pages',
    docsUrl: 'https://generaltranslation.com/en-US/docs/next/guides/local-tx',
  });

export const cacheComponentsMissingLoadTranslationsError =
  createGtNextDiagnostic({
    severity: 'Error',
    whatHappened:
      'cacheComponents is enabled, but custom loadTranslations() is not configured',
    wayOut:
      'gt-next cannot safely use the default remote translation loader with Cache Components',
    fix: 'Add a loadTranslations.ts file, or configure loadTranslationsPath, and mark any dynamic loading with "use cache"',
  });

export const cacheComponentsDevHotReloadDisabledWarning =
  createGtNextDiagnostic({
    severity: 'Warning',
    whatHappened:
      'cacheComponents is enabled, so development runtime translation hot reload has been disabled',
    why: 'development runtime translation performs dynamic requests that are not allowed with Cache Components',
    fix: 'Use local translations, or disable cacheComponents while using development runtime translation hot reload',
  });
