import * as fs from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  findOrCreateEntry,
  readLockfile,
  writeLockfile,
} from '../../fs/config/downloadedVersions.js';
import type { Settings } from '../../types/index.js';
import { persistPostProcessHashes } from '../persistPostprocessHashes.js';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock('../../fs/config/downloadedVersions.js', () => ({
  findOrCreateEntry: vi.fn(),
  readLockfile: vi.fn(),
  writeLockfile: vi.fn(),
}));

vi.mock('../hash.js', () => ({
  hashStringSync: vi.fn(() => 'translated-hash'),
}));

describe('persistPostProcessHashes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.readFileSync).mockReturnValue('translated content');
    vi.mocked(readLockfile).mockReturnValue({
      data: { version: 2, branchId: 'branch-1', entries: [] },
      entryMap: new Map(),
      originalV1: null,
    });
    vi.mocked(findOrCreateEntry).mockReturnValue({
      fileId: 'file-1',
      versionId: 'version-1',
      translations: {},
    });
  });

  it('uses downloaded metadata to read the branch-scoped lockfile', () => {
    persistPostProcessHashes(
      {} as Settings,
      new Set(['out/es/messages.json']),
      new Map([
        [
          'out/es/messages.json',
          {
            branchId: 'branch-1',
            fileId: 'file-1',
            versionId: 'version-1',
            locale: 'es',
          },
        ],
      ])
    );

    expect(readLockfile).toHaveBeenCalledWith(
      expect.objectContaining({ _branchId: 'branch-1' })
    );
    expect(writeLockfile).toHaveBeenCalled();
  });
});
