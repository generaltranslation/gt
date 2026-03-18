import { getI18nManager } from '../i18n-manager/singleton-operations';

/**
 * Get the version ID for the current source
 * @returns The version ID, if set
 *
 * @example
 * const versionId = getVersionId();
 * console.log(versionId); // 'abc123'
 */
export function getVersionId() {
  const i18nManager = getI18nManager();
  return i18nManager.getVersionId();
}
