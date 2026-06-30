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
