import fs from 'node:fs/promises';
import path from 'node:path';

/** Writes `files`, by path relative to `root`. */
export async function writeFiles(
  root: string,
  files: Record<string, string>
): Promise<void> {
  for (const [file, content] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), content);
  }
}
