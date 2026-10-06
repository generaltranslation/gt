let storedFileNames: string[] | null = null;

/** Records the files the upload step found missing locally (renamed or removed). */
export function recordOrphanedFileNames(fileNames: string[]): void {
  storedFileNames = fileNames;
}

export function getOrphanedFileNames(): string[] | null {
  return storedFileNames;
}

export function clearOrphanedFileNames(): void {
  storedFileNames = null;
}
