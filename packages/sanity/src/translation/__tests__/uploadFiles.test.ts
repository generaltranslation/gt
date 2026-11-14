import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, ErrorCode } from '@generaltranslation/api';
import type { ProjectHandle } from 'generaltranslation';
import type { GTFile } from '../../types';
import { uploadFiles } from '../uploadFiles';

const flags = vi.hoisted(() => ({ allowNonDefaultSourceLocales: true }));

const api = vi.hoisted(() => ({
  uploadSourceFiles: vi.fn<ProjectHandle['uploadSourceFiles']>(),
  syncDefaultLocale: vi.fn<ProjectHandle['syncDefaultLocale']>(),
}));

vi.mock('../../adapter/core', () => ({
  gt: { defaultLocale: 'en' },
  projectFor: () => api,
}));
vi.mock('../../utils/translationSource', () => ({
  allowsNonDefaultSourceLocales: () => flags.allowNonDefaultSourceLocales,
}));

const document = {
  info: { documentId: 'doc-1', versionId: 'rev-1' } as GTFile,
  serializedDocument: { content: '<p>Hi</p>' },
} as Parameters<typeof uploadFiles>[0][number];

function uploadResult(status: 'succeeded' | 'failed') {
  return {
    summary: {
      total: 1,
      succeeded: status === 'succeeded' ? 1 : 0,
      failed: status === 'failed' ? 1 : 0,
    },
    results: [
      {
        branchId: 'branch-1',
        fileId: 'doc-1',
        versionId: 'rev-1',
        fileName: 'sanity/doc-1',
        fileFormat: 'HTML',
        status,
      },
    ],
  } as Awaited<ReturnType<ProjectHandle['uploadSourceFiles']>>;
}

describe('uploadFiles project default locale', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('syncs the project default locale to the source locale', async () => {
    vi.mocked(api.uploadSourceFiles).mockResolvedValue(
      uploadResult('succeeded')
    );
    vi.mocked(api.syncDefaultLocale).mockResolvedValue({
      status: 'updated',
      previousDefaultLocale: 'fr',
    });

    await uploadFiles([document], null);

    expect(api.syncDefaultLocale).toHaveBeenCalledWith('en');
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('warns and keeps the upload when the key cannot update the project', async () => {
    const result = uploadResult('succeeded');
    vi.mocked(api.uploadSourceFiles).mockResolvedValue(result);
    vi.mocked(api.syncDefaultLocale).mockResolvedValue({
      status: 'permission_missing',
      previousDefaultLocale: 'fr',
      error: new ApiError('Forbidden', 403, ErrorCode.PERMISSION_MISSING),
    });

    await expect(uploadFiles([document], null)).resolves.toBe(result);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("project's default locale was not updated")
    );
  });

  it('leaves the project alone when no document was saved', async () => {
    vi.mocked(api.uploadSourceFiles).mockResolvedValue(uploadResult('failed'));

    await uploadFiles([document], null);

    expect(api.syncDefaultLocale).not.toHaveBeenCalled();
  });
});

describe('uploadFiles source locales and preview URLs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    flags.allowNonDefaultSourceLocales = true;
    vi.mocked(api.uploadSourceFiles).mockResolvedValue(uploadResult('failed'));
  });

  const upload = (...infos: GTFile[]) =>
    uploadFiles(
      infos.map((info) => ({ ...document, info })),
      null
    );
  const sentSources = () =>
    vi.mocked(api.uploadSourceFiles).mock.calls[0][0].map(({ source }) => ({
      fileId: source.fileId,
      locale: source.locale,
      metadata: source.metadata,
    }));

  it('sends each file in its own language with the default request-level source locale', async () => {
    await upload(
      { documentId: 'page', versionId: 'r1' },
      { documentId: 'page-fr', versionId: 'r2', sourceLocale: 'fr' }
    );

    expect(sentSources()).toEqual([
      { fileId: 'page', locale: 'en', metadata: undefined },
      { fileId: 'page-fr', locale: 'fr', metadata: undefined },
    ]);
    expect(vi.mocked(api.uploadSourceFiles).mock.calls[0][1]).toEqual({
      sourceLocale: 'en',
    });
  });

  it('sends every file in the configured source locale without allowNonDefaultSourceLocales', async () => {
    flags.allowNonDefaultSourceLocales = false;

    await upload({
      documentId: 'page-fr',
      versionId: 'r2',
      sourceLocale: 'fr',
    });

    expect(sentSources()).toEqual([
      { fileId: 'page-fr', locale: 'en', metadata: undefined },
    ]);
  });

  it("sends a document's page as its version's preview URL", async () => {
    await upload({
      documentId: 'page',
      versionId: 'r1',
      previewUrl: 'https://staging.acme.test/en/page',
    });

    expect(sentSources()).toEqual([
      {
        fileId: 'page',
        locale: 'en',
        metadata: { previewUrl: 'https://staging.acme.test/en/page' },
      },
    ]);
  });
});
