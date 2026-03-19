import { ResolvedFiles, Settings } from '../types/index.js';
import { SUPPORTED_FILE_EXTENSIONS } from '../formats/files/supportedFiles.js';
import { getRelative } from '../fs/findFilepath.js';
import { hashStringSync } from './hash.js';

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
    settings.files.gtJson?.publish !== undefined ||
    (settings.files.publishPaths?.size ?? 0) > 0 ||
    (settings.files.unpublishPaths?.size ?? 0) > 0
  );
}

/**
 * Determines whether gtjson content should be published.
 * Uses the gt-specific publish flag if set, otherwise falls back to global.
 */
export function shouldPublishGt(settings: Settings): boolean {
  if (settings.files.gtJson?.publish === false) return false;
  if (settings.files.gtJson?.publish === true) return true;
  return settings.publish;
}

/**
 * Builds a publish map from resolved file paths.
 * Maps fileId -> shouldPublish for each file.
 *
 * When a global publish flag is set, all files are included (global determines
 * the default, per-file config overrides). When there's no global flag, only
 * files with explicit per-pattern publish config are included.
 */
export function buildPublishMap(
  filePaths: ResolvedFiles,
  settings: Settings
): Map<string, boolean> {
  const publishMap = new Map<string, boolean>();
  const hasGlobal = settings.publish;

  for (const fileType of SUPPORTED_FILE_EXTENSIONS) {
    if (filePaths[fileType]) {
      for (const absolutePath of filePaths[fileType]) {
        const isExplicit =
          settings.files.publishPaths?.has(absolutePath) ||
          settings.files.unpublishPaths?.has(absolutePath);

        // Only include files with explicit config when there's no global flag
        if (!hasGlobal && !isExplicit) continue;

        const relativePath = getRelative(absolutePath);
        const fileId = hashStringSync(relativePath);
        publishMap.set(fileId, shouldPublishFile(absolutePath, settings));
      }
    }
  }
  return publishMap;
}
