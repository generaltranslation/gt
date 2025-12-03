// ---- ERRORS ---- //
export const cacheComponentsLegacySsgConflictError =
  'gt-next Error: experimentalLocaleResolution and the deprecated experimentalEnableSSG are enabled. Only one of these can be enabled at a time.';

// ---- WARNINGS ---- //
export const cacheComponentsMissingExperimentalLocaleResolutionWarning =
  'gt-next: cacheComponents is enabled, but experimentalLocaleResolution is not enabled. experimentalLocaleResolution must be enabled for i18n to work inside of cached components.';

export const cacheComponentsExperimentalFeatureWarning =
  'gt-next: You are using an experimental feature: experimentalLocaleResolution.';

export const cacheComponentsExperimentalFeatureDisableGetRequestFunctionWarning =
  'gt-next: Because experimentalLocaleResolution is enabled, functions getRegion and getDomain are disabled.';

export const cacheComponentsExperimentalLocaleResolutionDisableCustomGetLocaleWarning =
  'gt-next: experimentalLocaleResolution is enabled. Your provided getLocale function will be ignored.';

export const cacheComponentsNonLocalTranslationsWarning =
  'gt-next Error: cacheComponents is enabled, but you are not storing translations locally. Prerendering step may fail. Please follow these instructions to store translations locally: https://generaltranslation.com/en-US/docs/next/guides/local-tx';

export const experimentalLocaleResolutionWithoutCacheComponentsWarning =
  'gt-next: experimentalLocaleResolution is enabled, but cacheComponents disabled. experimentalLocaleResolution is meant to be used with cacheComponents. If this is intentional, ignore this warning.';
