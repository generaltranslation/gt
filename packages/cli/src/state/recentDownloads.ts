type DownloadMeta = {
  branchId: string;
  fileId: string;
  versionId: string;
  locale: string;
  inputPath?: string;
};

const recent = new Set<string>();
const recentMeta = new Map<string, DownloadMeta>();
const remerged = new Set<string>();

export function recordDownloaded(filePath: string, meta?: DownloadMeta) {
  recent.add(filePath);
  if (meta) {
    recentMeta.set(filePath, meta);
  }
}

/**
 * Track a file that was re-merged with the source
 * so that postprocessing still runs on it.
 */
export function recordRemerged(filePath: string) {
  remerged.add(filePath);
}

export function getDownloaded(): Set<string> {
  return recent;
}

/** Files that need postprocessing: downloaded OR re-merged */
export function getNeedsPostprocessing(): Set<string> {
  return new Set([...recent, ...remerged]);
}

export function getDownloadedMeta(): Map<string, DownloadMeta> {
  return recentMeta;
}

export function clearDownloaded() {
  recent.clear();
  recentMeta.clear();
  remerged.clear();
}
