import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  downloadFiles,
  enqueueFileTranslations,
  generateProjectContext,
  getProjectInfo,
  publishFiles,
} from '@generaltranslation/api';
import { GTRuntime } from '../runtime';
import { GT } from '../index';

vi.mock('@generaltranslation/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@generaltranslation/api')>()),
  downloadFiles: vi.fn(),
  enqueueFileTranslations: vi.fn(),
  generateProjectContext: vi.fn(),
  getProjectInfo: vi.fn(),
  publishFiles: vi.fn(),
}));

function result<T>(data: T) {
  return {
    data,
    request: new Request('https://api.example.com'),
    response: new Response(),
  };
}

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
  afterEach(() => vi.unstubAllGlobals());

  it('preserves configured identity while sending canonical runtime codes', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => Response.json({}));
    vi.stubGlobal('fetch', fetchMock);
    const gt = new GTRuntime(config);
    expect(gt.sourceLocale).toBe('en-us');
    expect(gt.locales).toEqual(['en-us', 'british', 'partner-uk']);
    await gt.translateMany(['Hello'], { targetLocale: 'british' });
    await gt.translate('Hello', {
      sourceLocale: 'en-us',
      targetLocale: 'en-gb',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [input, init] of fetchMock.mock.calls) {
      expect(await new Request(input, init).json()).toMatchObject({
        sourceLocale: 'en-US',
        targetLocale: 'en-GB',
      });
    }
  });

  it('restores configured identities from service responses without dialect fallback', async () => {
    vi.mocked(getProjectInfo).mockResolvedValue(
      result({
        id: 'test-project',
        name: 'Test',
        orgId: 'test-org',
        defaultLocale: 'en-US',
        currentLocales: ['en-US', 'en-GB', 'fr-FR', 'en-AU'],
        autoApprove: false,
      })
    );
    const result_ = await new GT(config).getProjectData('test-project');
    expect(await new GT(config).getProjectInfo()).toEqual(
      expect.objectContaining(result_)
    );
    expect(result_.defaultLocale).toBe('en-us');
    expect(result_.currentLocales).toEqual([
      'en-us',
      'british',
      'fr-FR',
      'en-AU',
    ]);
  });

  it('canonicalizes project and file requests', async () => {
    vi.mocked(generateProjectContext).mockResolvedValue(
      result({ status: 'completed' as const })
    );
    vi.mocked(enqueueFileTranslations).mockResolvedValue(
      result({ jobData: {}, message: 'Enqueued' })
    );
    const gt = new GT(config);
    await gt.setupProject([], { locales: ['british', 'fr-fr'] });
    expect(generateProjectContext).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ locales: ['en-GB', 'fr-FR'] }),
      })
    );
    const enqueued = await gt.enqueueFiles(
      [{ fileId: 'file-id', versionId: 'version-id', branchId: 'branch-id' }],
      {
        sourceLocale: 'en-us',
        targetLocales: ['partner-uk'],
      }
    );
    expect(enqueued.locales).toEqual(['partner-uk']);
    expect(enqueueFileTranslations).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          sourceLocale: 'en-US',
          targetLocales: ['en-GB'],
        }),
      })
    );
  });

  it('restores requested download identities and published locale identities', async () => {
    vi.mocked(downloadFiles).mockResolvedValue(
      result({
        files: [
          {
            id: 'translation-1',
            fileId: 'file-1',
            branchId: 'branch-1',
            versionId: 'version-1',
            locale: 'en-GB',
            data: '{}',
            metadata: {},
            fileFormat: 'JSON' as const,
          },
          {
            id: 'translation-2',
            fileId: 'file-2',
            branchId: 'branch-2',
            versionId: 'version-2',
            locale: 'fr-FR',
            data: '{}',
            metadata: {},
            fileFormat: 'JSON' as const,
          },
        ],
        count: 2,
      })
    );
    vi.mocked(publishFiles).mockResolvedValue(
      result({
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
      })
    );

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
    expect(downloadFiles).toHaveBeenCalledWith(
      expect.objectContaining({
        body: [
          expect.objectContaining({ fileId: 'file-1', locale: 'en-GB' }),
          expect.objectContaining({ fileId: 'file-2', locale: 'fr-FR' }),
        ],
      })
    );

    const published = await gt.publishFiles([]);
    expect(published.results.map(({ locale }) => locale)).toEqual([
      'en-us',
      'british',
      'fr-FR',
    ]);
  });
});
