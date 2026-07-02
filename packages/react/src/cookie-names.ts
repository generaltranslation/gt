// Re-export the shared default cookie-name constants from react-core so there
// is a single source of truth for these on-the-wire keys. Divergence here would
// silently break locale/region/enable-i18n persistence with no compile error.
export {
  defaultLocaleCookieName,
  defaultRegionCookieName,
  defaultEnableI18nCookieName,
  defaultResetLocaleCookieName,
} from '@generaltranslation/react-core/cookies';
