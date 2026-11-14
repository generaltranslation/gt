import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';
import { writeFileAtomically } from '../../src/compiler/utils/write-file.js';

afterEach(() => {
  vi.restoreAllMocks();
});

test('writes through a link, and keeps the permissions of the file', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'write-file-'));
  const file = path.join(directory, 'shared.json');
  const link = path.join(directory, 'gt-lock.json');
  await fs.writeFile(file, 'before');
  await fs.chmod(file, 0o640);
  await fs.symlink(file, link);

  await writeFileAtomically(link, [Buffer.from('after')]);

  expect((await fs.lstat(link)).isSymbolicLink()).toBe(true);
  expect(await fs.readFile(file, 'utf8')).toBe('after');
  expect((await fs.stat(file)).mode & 0o777).toBe(0o640);
  await fs.rm(directory, { recursive: true });
});

test('a write that stops short is continued', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'write-file-'));
  const file = path.join(directory, 'gt-lock.json');
  const open = fs.open.bind(fs);
  vi.spyOn(fs, 'open').mockImplementation(async (target, flags) => {
    const handle = await open(target, flags);

    // As at a file size limit, each write takes 3 bytes at most.
    const write = handle.write.bind(handle);
    handle.write = ((buffer: Buffer, offset = 0) =>
      write(
        buffer,
        offset,
        Math.min(3, buffer.length - offset)
      )) as typeof handle.write;

    return handle;
  });

  await writeFileAtomically(file, [Buffer.from('{ "version": 2 }\n')]);

  expect(await fs.readFile(file, 'utf8')).toBe('{ "version": 2 }\n');
  await fs.rm(directory, { recursive: true });
});
