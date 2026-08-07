import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Publishes a complete generated file without replacing an existing path.
 *
 * Content is first written and flushed to a same-directory temporary file.
 * A hard link then makes that complete inode visible at the destination while
 * retaining `O_EXCL`-style no-clobber semantics. Temporary files are removed
 * on success and failure, including when writing only part of the content
 * throws. Callers remain responsible for validating an existing destination
 * according to their package-specific path policy.
 *
 * @param filePath - Final generated file path in an existing directory.
 * @param content - Complete UTF-8 source to publish.
 * @param validateExisting - Revalidates a destination that wins a race.
 * @returns True when this call created the destination, otherwise false.
 */
export async function publishNewFile(
  filePath: string,
  content: string,
  validateExisting: () => void | Promise<void>
): Promise<boolean> {
  const temporaryPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.gt-${process.pid}-${randomUUID()}.tmp`
  );

  let ownsTemporaryFile = false;

  try {
    const handle = await fs.promises.open(temporaryPath, 'wx', 0o666);
    ownsTemporaryFile = true;
    try {
      await handle.writeFile(content, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }

    try {
      await fs.promises.link(temporaryPath, filePath);
      return true;
    } catch (error) {
      if (!isNodeError(error, 'EEXIST')) throw error;
      await validateExisting();
      return false;
    }
  } finally {
    if (ownsTemporaryFile) {
      await fs.promises.unlink(temporaryPath).catch((error: unknown) => {
        if (!isNodeError(error, 'ENOENT')) throw error;
      });
    }
  }
}

function isNodeError(error: unknown, code: string): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === code
  );
}
