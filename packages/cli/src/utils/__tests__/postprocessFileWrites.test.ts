import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  observePostprocessFileWrites,
  writePostprocessedFile,
  writePostprocessedFileSync,
} from '../postprocessFileWrites.js';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('postprocessFileWrites', () => {
  it('observes successful asynchronous and synchronous writes', async () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'gt-postprocess-writes-')
    );
    temporaryDirectories.push(directory);
    const observer = vi.fn();
    const asyncPath = path.join(directory, 'async.json');
    const syncPath = path.join(directory, 'sync.json');

    await observePostprocessFileWrites(observer, async () => {
      await writePostprocessedFile(asyncPath, '{"async":true}');
      writePostprocessedFileSync(syncPath, '{"sync":true}');
    });

    expect(observer.mock.calls).toEqual([
      [asyncPath, '{"async":true}'],
      [syncPath, '{"sync":true}'],
    ]);
  });

  it('does not observe a failed write', async () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'gt-postprocess-writes-')
    );
    temporaryDirectories.push(directory);
    const observer = vi.fn();

    await expect(
      observePostprocessFileWrites(observer, () =>
        writePostprocessedFile(
          path.join(directory, 'missing-parent', 'file.json'),
          '{}'
        )
      )
    ).rejects.toThrow();
    expect(observer).not.toHaveBeenCalled();
  });
});
