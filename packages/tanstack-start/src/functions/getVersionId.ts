import { getI18nManager } from 'gt-i18n/internal';

/**
 * Returns the version ID for the current source.
 * @returns {string | undefined} The version ID, if set.
 */
export function getVersionId() {
  const i18nManager = getI18nManager();
  return i18nManager.getVersionId();
}
