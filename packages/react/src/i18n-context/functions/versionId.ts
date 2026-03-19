import { getBrowserI18nManager } from '../browser-i18n-manager/singleton-operations';

/**
 * Returns the version ID for the current source.
 * @returns {string | undefined} The version ID, if set.
 *
 * @example
 * const versionId = getVersionId();
 * console.log(versionId); // 'abc123'
 */
export function getVersionId() {
  const i18nManager = getBrowserI18nManager();
  return i18nManager.getVersionId();
}
