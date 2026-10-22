import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getProject,
  publishFiles,
  queryFilesContent,
} from '@generaltranslation/api';
import { GTRuntime } from '../runtime';
import { GT } from '../index';

vi.mock('@generaltranslation/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@generaltranslation/api')>()),
  getProject: vi.fn(),
  publishFiles: vi.fn(),
  queryFilesContent: vi.fn(),
}));

function result<T>(data: T) {
  return {
    data,
    request: new Request('https://api.example.com'),
    response: new Response(),
  };
}

const config = {
  apiKey: 'test-key',
  projectId: 'test-project',
  localeConfig: {
    defaultLocale: 'en-us',
    locales: ['en-us', 'british', 'partner-uk'],
    customMapping: {
      british: { code: 'en-gb' },
      'partner-uk': { code: 'en-gb' },
    },
  },
};

describe.sequential('configured locales at GT service boundaries', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllGlobals());

  it('preserves configured identity while sending canonical runtime codes', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({ translations: {}, generated: false })
    );
    vi.stubGlobal('fetch', fetchMock);
    const project = new GTRuntime(config);
    expect(project.localeConfig).toEqual(config.localeConfig);
    await project.translateMany(['Hello'], { targetLocale: 'british' });
    await project.translate('Hello', {
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
    vi.mocked(getProject).mockResolvedValue(
      result({
        id: 'test-project',
        name: 'Test',
        orgId: 'test-org',
        defaultLocale: 'en-US',
        currentLocales: ['en-US', 'en-GB', 'fr-FR', 'en-AU'],
        autoApprove: false,
        cdnEnabled: false,
      })
    );
    const result_ = await new GT(config).get();
    expect(result_.defaultLocale).toBe('en-us');
    expect(result_.currentLocales).toEqual([
      'en-us',
      'british',
      'fr-FR',
      'en-AU',
    ]);
  });

  it('restores requested download identities and published locale identities', async () => {
    vi.mocked(queryFilesContent).mockResolvedValue(
      result({
        results: [
          {
            status: 'ready' as const,
            fileId: 'file-1',
            branchId: 'branch-1',
            versionId: 'version-1',
            locale: 'en-GB',
            data: null,
            fileFormat: 'JSON' as const,
          },
          {
            status: 'ready' as const,
            fileId: 'file-2',
            branchId: 'branch-2',
            versionId: 'version-2',
            locale: 'fr-FR',
            data: null,
            fileFormat: 'JSON' as const,
          },
        ],
      })
    );
    vi.mocked(publishFiles).mockResolvedValue(
      result({
        summary: { total: 1, succeeded: 1, failed: 0 },
        results: [
          {
            fileId: 'file-1',
            versionId: 'version-1',
            branchId: 'branch-1',
            status: 'succeeded' as const,
            translations: [
              { locale: 'en-US', status: 'succeeded' as const },
              { locale: 'en-GB', status: 'succeeded' as const },
              { locale: 'fr-FR', status: 'succeeded' as const },
            ],
          },
        ],
      })
    );

    const gt = new GT(config);
    const downloads = await gt.queryFilesContent([
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
    expect(downloads.results.map(({ locale }) => locale)).toEqual([
      'partner-uk',
      'fr-FR',
    ]);
    expect(queryFilesContent).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          files: [
            expect.objectContaining({ fileId: 'file-1', locale: 'en-GB' }),
            expect.objectContaining({ fileId: 'file-2', locale: 'fr-FR' }),
          ],
        },
      })
    );

    const published = await gt.publishFiles([
      {
        fileId: 'file-1',
        versionId: 'version-1',
        branchId: 'branch-1',
        publish: true,
      },
    ]);
    expect(
      published.results[0].translations.map(({ locale }) => locale)
    ).toEqual(['en-us', 'british', 'fr-FR']);
  });
});
