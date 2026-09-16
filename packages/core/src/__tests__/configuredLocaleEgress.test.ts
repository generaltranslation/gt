import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GTRuntime } from '../runtime';
import { GT } from '../index';
import { _translateMany } from '../translate/translateMany';
import { _setupProject } from '../translate/setupProject';
import { _getProjectInfo } from '../translate/getProjectInfo';
import { _getProjectData } from '../projects/getProjectData';
import { _enqueueFiles } from '../translate/enqueueFiles';
import { _downloadFileBatch } from '../translate/downloadFileBatch';
import { _publishFiles } from '../translate/publishFiles';

vi.mock('../translate/translateMany', () => ({
  _translateMany: vi.fn(async () => []),
}));
vi.mock('../translate/setupProject', () => ({
  _setupProject: vi.fn(async () => ({})),
}));
vi.mock('../translate/enqueueFiles', () => ({
  _enqueueFiles: vi.fn(async () => ({
    locales: ['en-GB'],
    jobData: {},
    message: 'Enqueued',
  })),
}));
vi.mock('../translate/downloadFileBatch', () => ({
  _downloadFileBatch: vi.fn(),
}));
vi.mock('../translate/publishFiles', () => ({ _publishFiles: vi.fn() }));

vi.mock('../projects/getProjectData', () => ({ _getProjectData: vi.fn() }));

vi.mock('../translate/getProjectInfo', () => ({ _getProjectInfo: vi.fn() }));

const config = {
  projectId: 'test-project',
  apiKey: 'test-key',
  sourceLocale: 'en-us',
  targetLocale: 'british',
  locales: ['en-us', 'british', 'partner-uk'],
  customMapping: {
    british: { code: 'en-gb' },
    'partner-uk': { code: 'en-gb' },
  },
};

describe.sequential('configured locales at GT service boundaries', () => {
  beforeEach(() => vi.clearAllMocks());

  it('preserves configured identity while sending canonical runtime codes', async () => {
    const gt = new GTRuntime(config);
    expect(gt.sourceLocale).toBe('en-us');
    expect(gt.locales).toEqual(['en-us', 'british', 'partner-uk']);
    await gt.translateMany(['Hello'], { targetLocale: 'british' });
    expect(_translateMany).toHaveBeenLastCalledWith(
      ['Hello'],
      expect.objectContaining({ sourceLocale: 'en-US', targetLocale: 'en-GB' }),
      expect.any(Object),
      undefined
    );
    await gt.translate('Hello', {
      sourceLocale: 'en-us',
      targetLocale: 'en-gb',
    });
    expect(_translateMany).toHaveBeenLastCalledWith(
      ['Hello'],
      expect.objectContaining({ sourceLocale: 'en-US', targetLocale: 'en-GB' }),
      expect.any(Object),
      undefined
    );
  });

  it('restores configured identities from service responses without dialect fallback', async () => {
    vi.mocked(_getProjectData).mockResolvedValue({
      id: 'test-project',
      name: 'Test',
      orgId: 'test-org',
      defaultLocale: 'en-US',
      currentLocales: ['en-US', 'en-GB', 'fr-FR', 'en-AU'],
    });
    vi.mocked(_getProjectInfo).mockResolvedValue(
      await vi.mocked(_getProjectData)('test-project', {}, {})
    );
    const result = await new GT(config).getProjectData('test-project');
    expect(await new GT(config).getProjectInfo()).toEqual(result);
    expect(result.defaultLocale).toBe('en-us');
    expect(result.currentLocales).toEqual([
      'en-us',
      'british',
      'fr-FR',
      'en-AU',
    ]);
  });

  it('canonicalizes project and file requests', async () => {
    const gt = new GT(config);
    await gt.setupProject([], { locales: ['british', 'fr-fr'] });
    expect(_setupProject).toHaveBeenCalledWith([], expect.any(Object), {
      locales: ['en-GB', 'fr-FR'],
    });
    const result = await gt.enqueueFiles([], {
      sourceLocale: 'en-us',
      targetLocales: ['partner-uk'],
    });
    expect(result.locales).toEqual(['partner-uk']);
    expect(_enqueueFiles).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        sourceLocale: 'en-US',
        targetLocales: ['en-GB'],
      }),
      expect.any(Object)
    );
  });

  it('restores requested download identities and published locale identities', async () => {
    vi.mocked(_downloadFileBatch).mockResolvedValue({
      data: [
        {
          id: 'translation-1',
          fileId: 'file-1',
          branchId: 'branch-1',
          versionId: 'version-1',
          locale: 'en-GB',
          data: '{}',
          metadata: {},
          fileFormat: 'JSON',
        },
        {
          id: 'translation-2',
          fileId: 'file-2',
          branchId: 'branch-2',
          versionId: 'version-2',
          locale: 'fr-FR',
          data: '{}',
          metadata: {},
          fileFormat: 'JSON',
        },
      ],
      count: 2,
      batchCount: 1,
    });
    vi.mocked(_publishFiles).mockResolvedValue({
      results: [
        {
          fileId: 'file-1',
          versionId: 'version-1',
          branchId: 'branch-1',
          locale: 'en-US',
          success: true,
        },
        {
          fileId: 'file-2',
          versionId: 'version-2',
          branchId: 'branch-2',
          locale: 'en-GB',
          success: true,
        },
        {
          fileId: 'file-3',
          versionId: 'version-3',
          branchId: 'branch-3',
          locale: 'fr-FR',
          success: true,
        },
      ],
    });

    const gt = new GT(config);
    const downloads = await gt.downloadFileBatch([
      {
        fileId: 'file-1',
        branchId: 'branch-1',
        versionId: 'version-1',
        locale: 'partner-uk',
      },
      {
        fileId: 'file-2',
        branchId: 'branch-2',
        versionId: 'version-2',
        locale: 'fr-FR',
      },
    ]);
    expect(downloads.files.map(({ locale }) => locale)).toEqual([
      'partner-uk',
      'fr-FR',
    ]);
    expect(_downloadFileBatch).toHaveBeenCalledWith(
      [
        expect.objectContaining({ fileId: 'file-1', locale: 'en-GB' }),
        expect.objectContaining({ fileId: 'file-2', locale: 'fr-FR' }),
      ],
      {},
      expect.any(Object)
    );

    const published = await gt.publishFiles([]);
    expect(published.results.map(({ locale }) => locale)).toEqual([
      'en-us',
      'british',
      'fr-FR',
    ]);
  });
});
