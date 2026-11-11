import fs from 'node:fs/promises';
import path from 'node:path';

/** Writes `files`, by path relative to `root`. */
export async function writeFiles(
  root: string,
  files: Record<string, string>
): Promise<void> {
  for (const [file, content] of Object.entries(files)) {
    const absolute = path.join(root, file);

    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, content);
  }
}
