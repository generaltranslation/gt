import { randomUUID } from 'node:crypto';
import fsp from 'node:fs/promises';

/**
 * Writes `chunks` to `file` through a temporary file: a reader never sees it
 * half written, and a run that stops midway leaves it as it was. A link is
 * written through, and the file keeps its permissions.
 *
 * With `expected`, what the file held when it was read, the file is replaced
 * only if it still holds it: false if another process wrote it since.
 */
export async function writeFileAtomically(
  file: string,
  chunks: Iterable<Buffer>,
  expected?: string
): Promise<boolean> {
  const target = await fsp.realpath(file).catch(() => file);
  const mode = await fsp.stat(target).then(
    (stats) => stats.mode & 0o777,
    () => undefined
  );
  // A unique name: other processes may write the same file.
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;

  try {
    const handle = await fsp.open(temporary, 'w');
    try {
      for (const chunk of chunks) {
        // A write can stop short, e.g. at a file size limit.
        let written = 0;
        while (written < chunk.length) {
          written += (await handle.write(chunk, written)).bytesWritten;
        }
      }
      if (mode !== undefined) await handle.chmod(mode);
    } finally {
      await handle.close();
    }

    // Read last, so that only a write in the time a rename takes is lost.
    const isCurrent =
      expected === undefined ||
      (await fsp.readFile(target, 'utf8').catch(() => undefined)) === expected;
    if (!isCurrent) {
      await fsp.rm(temporary, { force: true });
      return false;
    }

    await fsp.rename(temporary, target);
    return true;
  } catch (error) {
    // The failed write is what is reported, not a failed cleanup.
    await fsp.rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}
