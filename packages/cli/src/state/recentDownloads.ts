const recent = new Set<string>();

export function recordDownloaded(filePath: string) {
  recent.add(filePath);
}

export function getDownloaded(): Set<string> {
  return recent;
}

export function clearDownloaded() {
  recent.clear();
}

