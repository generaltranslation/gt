// Dependency-free module: these constants are imported by size-constrained
// consumers (e.g. gt-next's edge middleware), which must not pull in the
// ReactI18nConfig class or its gt-i18n imports.

/**
 * Cookie name for tracking the user's selected locale.
 */
export const defaultLocaleCookieName = 'generaltranslation.locale';

/**
 * Cookie name for tracking the user's selected region.
 */
export const defaultRegionCookieName = 'generaltranslation.region';

/**
 * Cookie name for persisting the enableI18n feature flag.
 */
export const defaultEnableI18nCookieName = 'generaltranslation.enable-i18n';

/**
 * Cookie name for tracking the locale reset.
 */
export const defaultResetLocaleCookieName = 'generaltranslation.locale-reset';
