export {
  defaultEnableI18nCookieName,
  defaultLocaleCookieName,
  defaultRegionCookieName,
} from 'gt-i18n/internal';

/**
 * Cookie name for tracking the locale reset
 * Used by gt-next middleware
 *
 * TODO: remove this cookie when come up with better solution
 */
export const defaultResetLocaleCookieName = 'generaltranslation.locale-reset';
