import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../fs/config/downloadedVersions.js', () => ({
  getDownloadedVersions: vi.fn(),
}));

vi.mock('../../formats/files/fileMapping.js', () => ({
  createFileMapping: vi.fn(),
}));

vi.mock('../../utils/gitDiff.js', () => ({
  getGitUnifiedDiff: vi.fn(),
}));

vi.mock('../../api/sendUserEdits.js', () => ({
  sendUserEditDiffs: vi.fn(),
}));

vi.mock('../../utils/gt.js', () => ({
  gt: {
    resolveAliasLocale: (l: string) => l,
    downloadTranslatedFile: vi.fn(),
  },
}));

import * as fs from 'fs';
vi.mock('fs', () => ({
  promises: {
    writeFile: vi.fn(),
    unlink: vi.fn(),
    readFile: vi.fn(),
  },
  existsSync: vi.fn(),
}));

import { collectAndSendUserEditDiffs } from '../collectUserEditDiffs';
import { getDownloadedVersions } from '../../fs/config/downloadedVersions.js';
import { createFileMapping } from '../../formats/files/fileMapping.js';
import { getGitUnifiedDiff } from '../../utils/gitDiff.js';
import { sendUserEditDiffs } from '../../api/sendUserEdits.js';
import { gt } from '../../utils/gt.js';

describe('collectAndSendUserEditDiffs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.promises.writeFile).mockResolvedValue(undefined as any);
    vi.mocked(fs.promises.unlink).mockResolvedValue(undefined as any);
    vi.mocked(fs.promises.readFile).mockResolvedValue('local content' as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('collects diffs and sends a single batch', async () => {
    vi.mocked(getDownloadedVersions as any).mockReturnValue({
      version: 1,
      entries: {
        'fileA.mdx:es': { versionId: 'v1', fileName: 'fileA.mdx' },
      },
    });
    vi.mocked(createFileMapping as any).mockReturnValue({
      es: { 'fileA.mdx': '/path/out/fileA.es.mdx' },
    });
    vi.mocked(getGitUnifiedDiff as any).mockResolvedValue('--- a\n+++ b\n-foo\n+bar\n');
    vi.mocked((gt as any).downloadTranslatedFile).mockResolvedValue('server');

    const uploadedFiles = [{ fileId: 'fid', versionId: 'v1', fileName: 'fileA.mdx' }];
    const settings: any = {
      configDirectory: '/tmp/.gt',
      files: {
        resolvedPaths: {} as any,
        placeholderPaths: {} as any,
        transformPaths: {} as any,
      },
      locales: ['es'],
      defaultLocale: 'en',
      projectId: 'pid',
    };

    await collectAndSendUserEditDiffs(uploadedFiles as any, settings);

    expect(sendUserEditDiffs).toHaveBeenCalledTimes(1);
    const [[diffs]] = vi.mocked(sendUserEditDiffs).mock.calls;
    expect(diffs).toHaveLength(1);
    expect(diffs[0]).toMatchObject({ fileName: 'fileA.mdx', locale: 'es' });
  });
});

