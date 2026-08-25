import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from 'generaltranslation/errors';
import { api, configureApiClient } from '../api.js';

const uploadedFile = {
  branchId: 'branch-id',
  fileId: 'file-id',
  versionId: 'version-id',
  fileName: 'messages.json',
  fileFormat: 'JSON',
  locale: 'en',
};

describe('CLI API client', () => {
  const fetchMock = vi.fn<typeof fetch>();
  let requestBodies: Array<{
    data: Array<{ source: { content: string } }>;
  }>;

  beforeEach(() => {
    fetchMock.mockReset();
    requestBodies = [];
    configureApiClient({
      apiKey: 'api-key',
      baseUrl: 'https://api.example.com',
      projectId: 'project-id',
      fetch: fetchMock,
    });
  });

  it('preserves HTTP status on API errors', async () => {
    fetchMock.mockResolvedValue(
      Response.json({ error: 'branching unavailable' }, { status: 403 })
    );

    await expect(api.queryBranchData({ branchNames: [] })).rejects.toEqual(
      expect.objectContaining<ApiError>({
        code: 403,
        message: 'branching unavailable',
      })
    );
  });

  it('base64-encodes and uploads source files in batches of 100', async () => {
    fetchMock.mockImplementation(async (request) => {
      const body = JSON.parse(await request.text()) as {
        data: Array<{ source: { content: string } }>;
      };
      requestBodies.push(body);
      return Response.json(
        {
          uploadedFiles: body.data.map(() => uploadedFile),
          count: body.data.length,
          message: 'uploaded',
        },
        { status: 201 }
      );
    });

    const result = await api.uploadSourceFiles(
      Array.from({ length: 101 }, (_, index) => ({
        source: {
          content: `message-${index}`,
          fileName: `messages-${index}.json`,
          fileFormat: 'JSON',
          locale: 'en',
        },
      })),
      { sourceLocale: 'en' }
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(requestBodies[0].data).toHaveLength(100);
    expect(requestBodies[0].data[0].source.content).toBe('bWVzc2FnZS0w');
    expect(result.count).toBe(101);
  });

  it('base64-encodes and uploads translation files through the SDK', async () => {
    fetchMock.mockImplementation(async (request) => {
      const body = JSON.parse(await request.text()) as {
        data: Array<{
          source: { content: string };
          translations: Array<{ content: string }>;
        }>;
      };
      expect(body.data[0].source.content).toBe('c291cmNl');
      expect(body.data[0].translations[0].content).toBe('dHJhbnNsYXRpb24=');
      return Response.json(
        { uploadedFiles: [uploadedFile], count: 1, message: 'uploaded' },
        { status: 201 }
      );
    });

    const result = await api.uploadTranslations(
      [
        {
          source: {
            content: 'source',
            fileName: 'messages.json',
            fileFormat: 'JSON',
            locale: 'en',
          },
          translations: [
            {
              content: 'translation',
              fileName: 'es/messages.json',
              fileFormat: 'JSON',
              locale: 'es',
            },
          ],
        },
      ],
      { sourceLocale: 'en' }
    );

    expect(result.uploadedFiles).toEqual([uploadedFile]);
  });

  it('decodes text downloads and preserves binary downloads', async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        files: [
          {
            id: 'text',
            branchId: 'branch-id',
            fileId: 'text-id',
            versionId: 'version-id',
            data: 'aGVsbG8=',
            metadata: {},
            fileFormat: 'JSON',
          },
          {
            id: 'binary',
            branchId: 'branch-id',
            fileId: 'binary-id',
            versionId: 'version-id',
            data: 'binary-base64',
            metadata: {},
            fileFormat: 'LOTTIE',
          },
        ],
        count: 2,
      })
    );

    const result = await api.downloadFileBatch([
      { fileId: 'text-id' },
      { fileId: 'binary-id' },
    ]);

    expect(result.files.map(({ data }) => data)).toEqual([
      'hello',
      'binary-base64',
    ]);
  });

  it('downloads files in batches of 100', async () => {
    fetchMock.mockImplementation(async (request) => {
      const body = JSON.parse(await request.text()) as Array<{
        fileId: string;
      }>;
      return Response.json({
        files: body.map(({ fileId }) => ({
          id: fileId,
          branchId: 'branch-id',
          fileId,
          versionId: 'version-id',
          data: 'aGVsbG8=',
          metadata: {},
          fileFormat: 'JSON',
        })),
        count: body.length,
      });
    });

    const result = await api.downloadFileBatch(
      Array.from({ length: 101 }, (_, index) => ({ fileId: `file-${index}` }))
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.files).toHaveLength(101);
  });

  it('intersects orphan results across file ID batches', async () => {
    let requestCount = 0;
    fetchMock.mockImplementation(async () => {
      requestCount += 1;
      return Response.json({
        orphanedFiles: [
          {
            fileId: 'common-orphan',
            versionId: 'version-id',
            fileName: 'orphan.json',
          },
          {
            fileId: `batch-${requestCount}-only`,
            versionId: 'version-id',
            fileName: 'batch.json',
          },
        ],
      });
    });

    const result = await api.getOrphanedFiles(
      'branch-id',
      Array.from({ length: 101 }, (_, index) => `file-${index}`)
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.orphanedFiles).toEqual([
      {
        fileId: 'common-orphan',
        versionId: 'version-id',
        fileName: 'orphan.json',
      },
    ]);
  });

  it('enqueues files in batches of 100 and merges job data', async () => {
    let requestCount = 0;
    const batchSizes: number[] = [];
    fetchMock.mockImplementation(async (request) => {
      const body = JSON.parse(await request.text()) as {
        files: unknown[];
      };
      batchSizes.push(body.files.length);
      requestCount += 1;
      return Response.json({
        jobData: {
          [`job-${requestCount}`]: {
            sourceFileId: 'source-file-id',
            fileId: 'file-id',
            versionId: 'version-id',
            branchId: 'branch-id',
            targetLocale: 'es',
            projectId: 'project-id',
            force: false,
          },
        },
        locales: ['es'],
        message: 'enqueued',
      });
    });

    const result = await api.enqueueFiles(
      Array.from({ length: 101 }, (_, index) => ({
        branchId: 'branch-id',
        fileId: `file-${index}`,
        versionId: 'version-id',
        fileName: `messages-${index}.json`,
        fileFormat: 'JSON' as const,
      })),
      { sourceLocale: 'en', targetLocales: ['es'] }
    );

    expect(batchSizes).toEqual([100, 1]);
    expect(Object.keys(result.jobData)).toEqual(['job-1', 'job-2']);
  });
});
