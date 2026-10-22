import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from 'generaltranslation/errors';
import { api } from '../../adapter/core';
import type { GTFile } from '../../types';
import { uploadFiles } from '../uploadFiles';

vi.mock('../../adapter/core', () => ({
  api: {
    uploadSourceFiles: vi.fn(),
    getProject: vi.fn(),
    updateProject: vi.fn(),
  },
  gt: { sourceLocale: 'en' },
  overrideConfig: vi.fn(),
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
  } as Awaited<ReturnType<typeof api.uploadSourceFiles>>;
}

describe('uploadFiles project default locale', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('sets the project default locale when it differs from the source locale', async () => {
    vi.mocked(api.uploadSourceFiles).mockResolvedValue(
      uploadResult('succeeded')
    );
    vi.mocked(api.getProject).mockResolvedValue({
      defaultLocale: 'fr',
    } as Awaited<ReturnType<typeof api.getProject>>);

    await uploadFiles([document], null);

    expect(api.updateProject).toHaveBeenCalledWith({ defaultLocale: 'en' });
  });

  it('leaves the project alone when its default locale already matches', async () => {
    vi.mocked(api.uploadSourceFiles).mockResolvedValue(
      uploadResult('succeeded')
    );
    vi.mocked(api.getProject).mockResolvedValue({
      defaultLocale: 'en',
    } as Awaited<ReturnType<typeof api.getProject>>);

    await uploadFiles([document], null);

    expect(api.getProject).toHaveBeenCalledTimes(1);
    expect(api.updateProject).not.toHaveBeenCalled();
  });

  it('warns and keeps the upload when the key cannot update the project', async () => {
    const result = uploadResult('succeeded');
    vi.mocked(api.uploadSourceFiles).mockResolvedValue(result);
    vi.mocked(api.getProject).mockResolvedValue({
      defaultLocale: 'fr',
    } as Awaited<ReturnType<typeof api.getProject>>);
    vi.mocked(api.updateProject).mockRejectedValueOnce(
      new ApiError('Forbidden', 403)
    );

    await expect(uploadFiles([document], null)).resolves.toBe(result);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("project's default locale was not updated")
    );
  });

  it('propagates other project update errors', async () => {
    vi.mocked(api.uploadSourceFiles).mockResolvedValue(
      uploadResult('succeeded')
    );
    vi.mocked(api.getProject).mockResolvedValue({
      defaultLocale: 'fr',
    } as Awaited<ReturnType<typeof api.getProject>>);
    vi.mocked(api.updateProject).mockRejectedValueOnce(
      new ApiError('Server error', 500)
    );

    await expect(uploadFiles([document], null)).rejects.toThrow('Server error');
  });

  it('leaves the project alone when no document was saved', async () => {
    vi.mocked(api.uploadSourceFiles).mockResolvedValue(uploadResult('failed'));

    await uploadFiles([document], null);

    expect(api.getProject).not.toHaveBeenCalled();
    expect(api.updateProject).not.toHaveBeenCalled();
  });
});

describe('uploadFiles ID limits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(api.getProject).mockResolvedValue({
      defaultLocale: 'en',
    } as Awaited<ReturnType<typeof api.getProject>>);
  });

  it('fails a document whose ID is too long and uploads the others', async () => {
    // Like GT's request validation: one over-long file ID fails the request.
    vi.mocked(api.uploadSourceFiles).mockImplementation(async (files) => {
      if (files.some(({ source }) => source.fileId!.length > 64))
        throw new ApiError('Bad request', 400);
      return {
        summary: { total: files.length, succeeded: files.length, failed: 0 },
        results: files.map(({ source }) => ({
          branchId: 'branch-1',
          fileId: source.fileId!,
          versionId: source.versionId!,
          fileName: source.fileName,
          fileFormat: source.fileFormat,
          status: 'succeeded' as const,
        })),
      };
    });
    const longId = 'd'.repeat(65);
    const long = {
      ...document,
      info: { documentId: longId, versionId: 'rev-2' } as GTFile,
    };

    const result = await uploadFiles([document, long], null);

    expect(result.summary).toEqual({ total: 2, succeeded: 1, failed: 1 });
    expect(
      result.results.map(({ fileId, status, error }) => ({
        fileId,
        status,
        error,
      }))
    ).toEqual([
      { fileId: 'doc-1', status: 'succeeded', error: undefined },
      {
        fileId: longId,
        status: 'failed',
        error:
          'The document ID is longer than 64 characters, which General Translation cannot store',
      },
    ]);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining(longId));
  });
});
