import { Settings } from '../types/index.js';

/**
 * Determines whether a file should be published based on the publish resolution logic:
 * - If the file is explicitly opted OUT (unpublishPaths), never publish
 * - If the file is explicitly opted IN (publishPaths), always publish
 * - Otherwise, fall back to the global publish setting
 */
export function shouldPublishFile(
  resolvedPath: string,
  settings: Settings
): boolean {
  if (settings.files.unpublishPaths?.has(resolvedPath)) return false;
  if (settings.files.publishPaths?.has(resolvedPath)) return true;
  return settings.publish ?? false;
}

/**
 * Determines whether gtjson content should be published.
 * Uses the gt-specific publish flag if set, otherwise falls back to global.
 */
export function shouldPublishGt(settings: Settings): boolean {
  if (settings.files.gtPublish === false) return false;
  if (settings.files.gtPublish === true) return true;
  return settings.publish;
}
