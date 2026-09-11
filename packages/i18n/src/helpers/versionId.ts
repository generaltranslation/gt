import { getI18nRuntime } from '../i18n-cache/runtime-operations';

/**
 * Get the version ID for the current source
 * @returns The version ID, if set
 *
 * @example
 * const versionId = getVersionId();
 * console.log(versionId); // 'abc123'
 */
export function getVersionId() {
  return getI18nRuntime().getVersionId();
}
