type DownloadMeta = {
  branchId: string;
  fileId: string;
  versionId: string;
  locale: string;
  inputPath?: string;
};

const recent = new Set<string>();
const recentMeta = new Map<string, DownloadMeta>();

export function recordDownloaded(filePath: string, meta?: DownloadMeta) {
  recent.add(filePath);
  if (meta) {
    recentMeta.set(filePath, meta);
  }
}

export function getDownloaded(): Set<string> {
  return recent;
}

export function getDownloadedMeta(): Map<string, DownloadMeta> {
  return recentMeta;
}

export function clearDownloaded() {
  recent.clear();
  recentMeta.clear();
}
