import { AsyncLocalStorage } from 'node:async_hooks';
import * as fs from 'fs';
import path from 'node:path';

type FileWriteObserver = (filePath: string, content: string) => void;

const fileWriteObservers = new AsyncLocalStorage<FileWriteObserver>();

export function observePostprocessFileWrites<T>(
  observer: FileWriteObserver,
  operation: () => T
): T {
  return fileWriteObservers.run(observer, operation);
}

export async function writePostprocessedFile(
  filePath: string,
  content: string,
  encoding?: BufferEncoding
): Promise<void> {
  if (encoding) {
    await fs.promises.writeFile(filePath, content, encoding);
  } else {
    await fs.promises.writeFile(filePath, content);
  }
  fileWriteObservers.getStore()?.(path.resolve(filePath), content);
}

export function writePostprocessedFileSync(
  filePath: string,
  content: string,
  encoding?: BufferEncoding
): void {
  if (encoding) {
    fs.writeFileSync(filePath, content, encoding);
  } else {
    fs.writeFileSync(filePath, content);
  }
  fileWriteObservers.getStore()?.(path.resolve(filePath), content);
}
