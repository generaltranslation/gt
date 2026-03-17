// ---- ERRORS ---- //
export const cacheComponentsLegacySsgConflictError =
  'gt-next Error: experimentalLocaleResolution and the deprecated experimentalEnableSSG are enabled. Only one of these can be enabled at a time.';

export const experimentalLocaleResolutionError =
  'gt-next: Error resolving locale via experimentalLocaleResolution. Error: ';

// ---- WARNINGS ---- //
export const cacheComponentsMissingExperimentalLocaleResolutionWarning =
  'gt-next: cacheComponents is enabled, but experimentalLocaleResolution is not enabled. experimentalLocaleResolution must be enabled for i18n to work inside of cached components.';

export const cacheComponentsExperimentalFeatureWarning =
  'gt-next: experimentalLocaleResolution is an experimental feature.';

export const cacheComponentsExperimentalFeatureDisableGetRequestFunctionWarning =
  'gt-next: experimentalLocaleResolution is enabled. getRegion and getDomain are disabled.';

export const cacheComponentsExperimentalLocaleResolutionDisableCustomGetLocaleWarning =
  'gt-next: experimentalLocaleResolution is enabled. The provided getLocale function will be ignored.';

export const cacheComponentsNonLocalTranslationsWarning =
  'gt-next Error: cacheComponents is enabled, but translations are not stored locally. Prerendering may fail. Store translations locally: https://generaltranslation.com/en-US/docs/next/guides/local-tx';

export const experimentalLocaleResolutionWithoutCacheComponentsWarning =
  'gt-next: experimentalLocaleResolution is enabled, but cacheComponents is disabled. experimentalLocaleResolution is meant to be used with cacheComponents. If this is intentional, ignore this warning.';
