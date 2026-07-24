import { getI18nConfig } from '../i18n-config/singleton-operations';

/**
 * Get the version ID for the current source
 * @returns The version ID, if set
 *
 * @example
 * const versionId = getVersionId();
 * console.log(versionId); // 'abc123'
 */
export function getVersionId() {
  return getI18nConfig().getVersionId();
}
