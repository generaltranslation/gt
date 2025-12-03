// ---- ERRORS ---- //
export const cacheComponentSsgConflictError =
  'gt-next Error: experimentalLocaleResolution and the deprecated experimentalEnableSSG are enabled. Only one of these can be enabled at a time.';

// ---- WARNINGS ---- //
export const cacheComponentsMissingExperimentalLocaleResolutionWarning =
  'gt-next: cacheComponents is enabled, but experimentalLocaleResolution is not enabled. experimentalLocaleResolution must be enabled for i18n to work inside of cached components.';

export const cacheComponentsExperimentalFeatureWarning =
  'gt-next: You are using an experimental feature: experimentalLocaleResolution. This is a new feature and may be subject to change.';
