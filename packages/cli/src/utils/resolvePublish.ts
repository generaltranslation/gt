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
 * Returns true if the user has any explicit publish configuration —
 * global flag, gt-specific flag, or per-file publish/unpublish patterns.
 */
export function hasPublishConfig(settings: Settings): boolean {
  return (
    settings.publish ||
    settings.files.gtPublish !== undefined ||
    (settings.files.publishPaths?.size ?? 0) > 0 ||
    (settings.files.unpublishPaths?.size ?? 0) > 0
  );
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
