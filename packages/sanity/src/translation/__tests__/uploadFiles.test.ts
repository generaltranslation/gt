import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, ErrorCode } from 'generaltranslation/api';
import type { ProjectHandle } from 'generaltranslation';
import type { GTFile } from '../../types';
import { uploadFiles } from '../uploadFiles';

const api = vi.hoisted(() => ({
  uploadSourceFiles: vi.fn<ProjectHandle['uploadSourceFiles']>(),
  get: vi.fn(),
  update: vi.fn(),
}));

vi.mock('../../adapter/core', () => ({
  gt: { defaultLocale: 'en' },
  projectFor: () => api,
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

  it('sets the project default locale when it differs from the source locale', async () => {
    vi.mocked(api.uploadSourceFiles).mockResolvedValue(
      uploadResult('succeeded')
    );
    vi.mocked(api.get).mockResolvedValue({
      defaultLocale: 'fr',
    } as Awaited<ReturnType<ProjectHandle['get']>>);

    await uploadFiles([document], null);

    expect(api.update).toHaveBeenCalledWith({ defaultLocale: 'en' });
  });

  it('leaves the project alone when its default locale already matches', async () => {
    vi.mocked(api.uploadSourceFiles).mockResolvedValue(
      uploadResult('succeeded')
    );
    vi.mocked(api.get).mockResolvedValue({
      defaultLocale: 'en',
    } as Awaited<ReturnType<ProjectHandle['get']>>);

    await uploadFiles([document], null);

    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.update).not.toHaveBeenCalled();
  });

  it('warns and keeps the upload when the key cannot update the project', async () => {
    const result = uploadResult('succeeded');
    vi.mocked(api.uploadSourceFiles).mockResolvedValue(result);
    vi.mocked(api.get).mockResolvedValue({
      defaultLocale: 'fr',
    } as Awaited<ReturnType<ProjectHandle['get']>>);
    vi.mocked(api.update).mockRejectedValueOnce(
      new ApiError('Forbidden', 403, ErrorCode.PERMISSION_MISSING)
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
    vi.mocked(api.get).mockResolvedValue({
      defaultLocale: 'fr',
    } as Awaited<ReturnType<ProjectHandle['get']>>);
    vi.mocked(api.update).mockRejectedValueOnce(
      new ApiError('Server error', 500)
    );

    await expect(uploadFiles([document], null)).rejects.toThrow('Server error');
  });

  it('propagates a 403 that is not a missing permission', async () => {
    vi.mocked(api.uploadSourceFiles).mockResolvedValue(
      uploadResult('succeeded')
    );
    vi.mocked(api.get).mockResolvedValue({
      defaultLocale: 'fr',
    } as Awaited<ReturnType<ProjectHandle['get']>>);
    vi.mocked(api.update).mockRejectedValueOnce(
      new ApiError('IP not allowed', 403, ErrorCode.IP_NOT_ALLOWED)
    );

    await expect(uploadFiles([document], null)).rejects.toThrow(
      'IP not allowed'
    );
  });

  it('leaves the project alone when no document was saved', async () => {
    vi.mocked(api.uploadSourceFiles).mockResolvedValue(uploadResult('failed'));

    await uploadFiles([document], null);

    expect(api.get).not.toHaveBeenCalled();
    expect(api.update).not.toHaveBeenCalled();
  });
});

describe('uploadFiles ID limits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(api.get).mockResolvedValue({
      defaultLocale: 'en',
    } as Awaited<ReturnType<ProjectHandle['get']>>);
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
