import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import os from 'node:os';
import { collectAndSendUserEditDiffs } from '../collectUserEditDiffs.js';
import { createMockSettings } from '../__mocks__/settings.js';
import { gt } from '../../utils/gt.js';
import { getGitUnifiedDiff } from '../../utils/gitDiff.js';
import { hashStringSync } from '../../utils/hash.js';
import { getDownloadedVersions } from '../../fs/config/downloadedVersions.js';
import { createFileMapping } from '../../formats/files/fileMapping.js';

vi.mock('../../utils/gt.js', () => ({
  gt: {
    queryFileData: vi.fn(),
    downloadFileBatch: vi.fn(),
    submitUserEditDiffs: vi.fn(),
  },
}));

vi.mock('../../utils/gitDiff.js', () => ({
  getGitUnifiedDiff: vi.fn(),
}));

describe('collectAndSendUserEditDiffs', () => {
  const originalCwd = process.cwd();
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.realpathSync(
      fs.mkdtempSync(path.join(os.tmpdir(), 'gt-lock-'))
    );
    process.chdir(tempDir);
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempDir, { recursive: true, force: true });
    vi.resetAllMocks();
  });

  const buildSettings = () =>
    createMockSettings({
      configDirectory: tempDir,
      config: path.join(tempDir, 'gt.config.json'),
      defaultLocale: 'en',
      locales: ['en', 'ja'],
      files: {
        resolvedPaths: {
          md: [path.join(tempDir, 'docs', 'doc.md')],
        },
        placeholderPaths: {
          md: [path.join(tempDir, 'docs', '[locale]', 'doc.md')],
        },
        transformPaths: {},
      },
    });

  const writeLockFile = (content: any) => {
    fs.writeFileSync(
      path.join(tempDir, 'gt-lock.json'),
      JSON.stringify(content, null, 2)
    );
  };

  it('skips submitting diffs when local file hash matches postprocessed hash', async () => {
    const settings = buildSettings();
    const translatedPath = path.join(tempDir, 'docs', 'ja', 'doc.md');
    fs.mkdirSync(path.dirname(translatedPath), { recursive: true });
    const translatedContent = '# heading\n\nbody\n';
    fs.writeFileSync(translatedPath, translatedContent);

    // Seed lock file with matching postprocess hash
    writeLockFile({
      version: 1,
      entries: {
        branch1: {
          file1: {
            version1: {
              ja: {
                updatedAt: new Date().toISOString(),
                postProcessHash: hashStringSync(translatedContent),
              },
            },
          },
        },
      },
    });

    const files = [
      {
        fileName: 'docs/doc.md',
        fileFormat: 'MD',
        branchId: 'branch1',
        fileId: 'file1',
        versionId: 'version1',
      },
    ];

    const lock = getDownloadedVersions(settings.configDirectory);
    expect(
      lock.entries.branch1?.file1?.version1?.ja?.postProcessHash
    ).toBeDefined();

    await collectAndSendUserEditDiffs(files as any, settings);

    expect(gt.queryFileData).not.toHaveBeenCalled();
    expect(gt.downloadFileBatch).not.toHaveBeenCalled();
    expect(gt.submitUserEditDiffs).not.toHaveBeenCalled();
  });

  it('submits diffs when local file hash differs from postprocessed hash', async () => {
    const settings = buildSettings();
    const mapping = createFileMapping(
      settings.files.resolvedPaths,
      settings.files.placeholderPaths,
      settings.files.transformPaths,
      settings.locales,
      settings.defaultLocale
    );
    expect(mapping.ja['docs/doc.md']).toBe('docs/ja/doc.md');

    const translatedPath = path.join(tempDir, 'docs', 'ja', 'doc.md');
    fs.mkdirSync(path.dirname(translatedPath), { recursive: true });
    fs.writeFileSync(translatedPath, 'changed content');

    // Lock file has different hash
    writeLockFile({
      version: 1,
      entries: {
        branch1: {
          file1: {
            version1: {
              ja: {
                updatedAt: new Date().toISOString(),
                postProcessHash: hashStringSync('original content'),
              },
            },
          },
        },
      },
    });

    (gt.queryFileData as any).mockResolvedValue({
      translatedFiles: [
        {
          branchId: 'branch1',
          fileId: 'file1',
          versionId: 'version1',
          locale: 'ja',
          completedAt: new Date().toISOString(),
        },
      ],
    });

    (gt.downloadFileBatch as any).mockResolvedValue({
      files: [
        {
          branchId: 'branch1',
          fileId: 'file1',
          versionId: 'version1',
          locale: 'ja',
          data: 'server content',
        },
      ],
    });

    (getGitUnifiedDiff as any).mockResolvedValue('mock-diff');

    const files = [
      {
        fileName: 'docs/doc.md',
        fileFormat: 'MD',
        branchId: 'branch1',
        fileId: 'file1',
        versionId: 'version1',
      },
    ];

    await collectAndSendUserEditDiffs(files as any, settings);

    expect(gt.queryFileData).toHaveBeenCalledTimes(1);
    expect(gt.downloadFileBatch).toHaveBeenCalledTimes(1);
    expect(getGitUnifiedDiff).toHaveBeenCalledTimes(1);
    expect(gt.submitUserEditDiffs).toHaveBeenCalledTimes(1);
  });
});
