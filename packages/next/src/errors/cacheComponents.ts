import { createDiagnosticMessage } from 'generaltranslation/internal';

// ---- ERRORS ---- //
export const cacheComponentsLegacySsgConflictError = createDiagnosticMessage({
  source: 'gt-next',
  severity: 'Error',
  whatHappened:
    'experimentalLocaleResolution and deprecated experimentalEnableSSG are both enabled',
  fix: 'Disable one of them before building your app',
});

export const experimentalLocaleResolutionError =
  createDiagnosticMessage({
    source: 'gt-next',
    whatHappened: 'Locale resolution with experimentalLocaleResolution failed',
    wayOut: 'gt-next will fall back where possible',
  }) + ' Original error: ';

// ---- WARNINGS ---- //
export const cacheComponentsMissingExperimentalLocaleResolutionWarning =
  createDiagnosticMessage({
    source: 'gt-next',
    whatHappened:
      'cacheComponents is enabled, but experimentalLocaleResolution is not enabled',
    fix: 'Enable experimentalLocaleResolution so i18n can work inside cached components',
  });

export const cacheComponentsExperimentalFeatureWarning =
  'gt-next: experimentalLocaleResolution is an experimental feature.';

export const cacheComponentsExperimentalFeatureDisableGetRequestFunctionWarning =
  'gt-next: experimentalLocaleResolution is enabled. getRegion and getDomain are disabled.';

export const cacheComponentsExperimentalLocaleResolutionDisableCustomGetLocaleWarning =
  'gt-next: experimentalLocaleResolution is enabled. The provided getLocale function will be ignored.';

export const cacheComponentsNonLocalTranslationsWarning =
  createDiagnosticMessage({
    source: 'gt-next',
    severity: 'Warning',
    whatHappened:
      'cacheComponents is enabled, but translations are not stored locally',
    wayOut: 'Prerendering may fail',
    fix: 'Store translations locally before building cached pages',
    docsUrl: 'https://generaltranslation.com/en-US/docs/next/guides/local-tx',
  });

export const experimentalLocaleResolutionWithoutCacheComponentsWarning =
  'gt-next: experimentalLocaleResolution is enabled, but cacheComponents is disabled. experimentalLocaleResolution is meant to be used with cacheComponents. If this is intentional, ignore this warning.';
