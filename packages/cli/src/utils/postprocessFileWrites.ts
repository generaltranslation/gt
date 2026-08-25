import * as fs from 'fs';

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
}
