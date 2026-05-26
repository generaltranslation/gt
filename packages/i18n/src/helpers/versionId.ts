import { getI18nCache } from '../i18n-cache/singleton-operations';

/**
 * Get the version ID for the current source
 * @returns The version ID, if set
 *
 * @example
 * const versionId = getVersionId();
 * console.log(versionId); // 'abc123'
 */
export function getVersionId() {
  const i18nCache = getI18nCache();
  return i18nCache.getVersionId();
}
