import * as fs from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  findOrCreateEntry,
  readLockfile,
  writeLockfile,
} from '../../fs/config/downloadedVersions.js';
import type { Settings } from '../../types/index.js';
import { hashStringSync } from '../hash.js';
import { persistPostProcessHashes } from '../persistPostprocessHashes.js';

const mockFs = vi.hoisted(() => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock('node:fs', () => ({ default: mockFs, ...mockFs }));

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
            fileFormat: 'JSON' as const,
          },
        ],
      ])
    );

    expect(readLockfile).toHaveBeenCalledWith(
      expect.objectContaining({ _branchId: 'branch-1' })
    );
    expect(writeLockfile).toHaveBeenCalled();
  });

  it('hashes the decoded text of a translation stored in UTF-16', () => {
    const text = '"welcome" = "\u00a1Bienvenido!";\n';
    const filePath = 'Guardian/es.lproj/Localizable.strings';
    vi.mocked(fs.readFileSync).mockReturnValue(
      Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, 'utf16le')])
    );

    persistPostProcessHashes(
      {} as Settings,
      new Set([filePath]),
      new Map([
        [
          filePath,
          {
            branchId: 'branch-1',
            fileId: 'file-1',
            versionId: 'version-1',
            locale: 'es',
            fileFormat: 'DOT_STRINGS' as const,
          },
        ],
      ])
    );

    // The recorded hash has to stand for the same content every other producer
    // and consumer of it uses, not for the file's UTF-16 bytes read as UTF-8.
    expect(hashStringSync).toHaveBeenCalledWith(text);
  });
});
