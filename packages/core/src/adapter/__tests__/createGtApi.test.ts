import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createFileUploads,
  createProject,
  createProjectApiKey,
  downloadFiles,
  getFileInfo,
  getOrphanedFiles,
  getTranslationJobInfo,
  listOrgs,
  listProjects,
  publishFiles,
  putFileUpload,
  submitUserEditDiffs,
  updateFiles,
  uploadSourceFileReferences,
  uploadSourceFiles,
  uploadTranslations,
} from '@generaltranslation/api';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import type {
  PublishFilesData,
  SubmitUserEditDiffsData,
} from '@generaltranslation/api';
import { createGtApiAdapter } from '../createGtApi';

vi.mock('@generaltranslation/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@generaltranslation/api')>()),
  createFileUploads: vi.fn(),
  createProject: vi.fn(),
  createProjectApiKey: vi.fn(),
  downloadFiles: vi.fn(),
  getFileInfo: vi.fn(),
  getOrphanedFiles: vi.fn(),
  getTranslationJobInfo: vi.fn(),
  listOrgs: vi.fn(),
  listProjects: vi.fn(),
  publishFiles: vi.fn(),
  putFileUpload: vi.fn(),
  submitUserEditDiffs: vi.fn(),
  updateFiles: vi.fn(),
  uploadSourceFileReferences: vi.fn(),
  uploadSourceFiles: vi.fn(),
  uploadTranslations: vi.fn(),
}));

function result<T>(data: T) {
  return {
    data,
    request: new Request('https://api.example.com'),
    response: new Response(),
  };
}

const customMapping = {
  source: { code: 'en-US' },
  target: { code: 'es-ES' },
};

describe.sequential('createGtApiAdapter', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('fails before an adapter without defaults is configured', async () => {
    const adapter = createGtApiAdapter();

    await expect(adapter.createBranch({ branchName: 'main' })).rejects.toThrow(
      'API client not configured'
    );
    await expect(adapter.translate('Hello', 'es')).rejects.toThrow(
      'API client not configured'
    );
    await expect(adapter.translateMany(['Hello'], 'es')).rejects.toThrow(
      'API client not configured'
    );
  });

  it('resolves configured locales in both directions', () => {
    const adapter = createGtApiAdapter();
    adapter.configure({ baseUrl: 'https://api.example.com', customMapping });

    expect(adapter.resolveCanonicalLocale('target')).toBe('es-ES');
    expect(adapter.resolveCanonicalLocale('en-us')).toBe('en-US');
    expect(adapter.resolveAliasLocale('es-ES')).toBe('target');
  });

  it('refreshes management requests and clears omitted locale mappings on reconfiguration', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({ branchId: 'branch-id' })
    );
    const adapter = createGtApiAdapter({
      baseUrl: 'https://api.example.com',
      apiKey: 'old-key',
      projectId: 'old-project',
      customMapping,
      fetch: fetchMock,
    });
    await adapter.createBranch({ branchName: 'main' });
    expect(adapter.resolveAliasLocale('es-ES')).toBe('target');

    adapter.configure({
      baseUrl: 'https://reconfigured.example.com',
      apiKey: 'new-key',
      projectId: 'new-project',
      fetch: fetchMock,
    });
    await adapter.createBranch({ branchName: 'main' });

    const request = new Request(...fetchMock.mock.calls[1]);
    expect(new URL(request.url).origin).toBe(
      'https://reconfigured.example.com'
    );
    expect(request.headers.get('authorization')).toBe('Bearer new-key');
    expect(request.headers.get('gt-project-id')).toBe('new-project');
    expect(adapter.resolveAliasLocale('es-ES')).toBe('es-ES');
  });

  it.each([
    ['source', 'target'],
    ['en-us', 'es-es'],
  ])(
    'canonicalizes upload locales %s / %s',
    async (sourceLocale, targetLocale) => {
      const uploadedFile = {
        branchId: 'branch-id',
        fileId: 'file-id',
        versionId: 'version-id',
        fileName: 'document.html',
        fileFormat: 'HTML' as const,
      };
      vi.mocked(uploadTranslations).mockResolvedValue(
        result({
          uploadedFiles: [
            { ...uploadedFile, locale: 'en-US' },
            { ...uploadedFile, locale: 'es-ES' },
          ],
          count: 2,
          message: 'Uploaded files',
        })
      );
      const adapter = createGtApiAdapter();
      adapter.configure({
        baseUrl: 'https://api.example.com',
        customMapping: {
          source: { code: 'en-US' },
          target: { code: 'es-ES' },
        },
      });

      const response = await adapter.uploadTranslations(
        [
          {
            source: {
              content: 'source',
              fileName: 'document.html',
              fileFormat: 'HTML',
              locale: sourceLocale,
            },
            translations: [
              {
                content: 'translation',
                fileName: 'document.html',
                fileFormat: 'HTML',
                locale: targetLocale,
              },
            ],
          },
        ],
        { sourceLocale }
      );

      expect(uploadTranslations).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            sourceLocale: 'en-US',
            data: [
              expect.objectContaining({
                source: expect.objectContaining({ locale: 'en-US' }),
                translations: [expect.objectContaining({ locale: 'es-ES' })],
              }),
            ],
          }),
        })
      );
      expect(response.uploadedFiles.map((file) => file.locale)).toEqual([
        'source',
        'target',
      ]);
    }
  );

  it('maps pending download locales back to configured aliases', async () => {
    const pending = {
      branchId: 'branch-id',
      fileId: 'file-id',
      versionId: 'version-id',
    };
    vi.mocked(downloadFiles).mockResolvedValue(
      result({
        files: [],
        count: 0,
        pending: [{ ...pending, locale: 'es-ES' }],
      })
    );
    const adapter = createGtApiAdapter();
    adapter.configure({ baseUrl: 'https://api.example.com', customMapping });

    const response = await adapter.downloadFileBatch([
      { ...pending, locale: 'target' },
    ]);

    expect(response.pending).toEqual([{ ...pending, locale: 'target' }]);
  });

  it('intersects orphaned files returned across request batches', async () => {
    vi.mocked(getOrphanedFiles)
      .mockResolvedValueOnce(
        result({
          orphanedFiles: [
            { fileId: 'only-first', versionId: 'v1', fileName: 'first.json' },
            { fileId: 'orphan', versionId: 'v2', fileName: 'orphan.json' },
          ],
        })
      )
      .mockResolvedValueOnce(
        result({
          orphanedFiles: [
            { fileId: 'orphan', versionId: 'v2', fileName: 'orphan.json' },
            { fileId: 'only-second', versionId: 'v3', fileName: 'second.json' },
          ],
        })
      );
    const adapter = createGtApiAdapter({
      baseUrl: 'https://api.example.com',
    });

    const response = await adapter.getOrphanedFiles(
      'branch-id',
      Array.from({ length: 101 }, (_, index) => `file-${index}`)
    );

    expect(getOrphanedFiles).toHaveBeenCalledTimes(2);
    expect(response.orphanedFiles).toEqual([
      { fileId: 'orphan', versionId: 'v2', fileName: 'orphan.json' },
    ]);
  });

  it('creates a project under the organization with a canonical default locale', async () => {
    vi.mocked(createProject).mockResolvedValue(
      result({
        project: {
          id: 'project-id',
          name: 'Project',
          orgId: 'org-id',
          defaultLocale: 'en-US',
        },
      })
    );
    const adapter = createGtApiAdapter({
      baseUrl: 'https://api.example.com',
      customMapping,
    });

    await adapter.createProject('org-id', {
      name: 'Project',
      defaultLocale: 'source',
    });

    expect(createProject).toHaveBeenCalledWith(
      expect.objectContaining({
        path: { orgId: 'org-id' },
        body: { name: 'Project', defaultLocale: 'en-US' },
      })
    );
  });

  it('lists projects across every cursor page', async () => {
    const project = (id: string) => ({
      id,
      name: id,
      orgId: 'org-id',
      orgName: 'Org',
    });
    vi.mocked(listProjects)
      .mockResolvedValueOnce(
        result({ items: [project('p1')], nextCursor: 'cursor-1' })
      )
      .mockResolvedValueOnce(
        result({ items: [project('p2')], nextCursor: 'cursor-2' })
      )
      .mockResolvedValueOnce(
        result({ items: [project('p3')], nextCursor: null })
      );
    const adapter = createGtApiAdapter({
      baseUrl: 'https://api.example.com',
    });

    const projects = await adapter.listProjects();

    expect(projects.map((entry) => entry.id)).toEqual(['p1', 'p2', 'p3']);
    expect(
      vi.mocked(listProjects).mock.calls.map(([options]) => options.query)
    ).toEqual([
      { cursor: undefined },
      { cursor: 'cursor-1' },
      { cursor: 'cursor-2' },
    ]);
  });

  it('lists organizations across every cursor page', async () => {
    vi.mocked(listOrgs)
      .mockResolvedValueOnce(
        result({ items: [{ id: 'o1', name: 'Org 1' }], nextCursor: 'next' })
      )
      .mockResolvedValueOnce(
        result({ items: [{ id: 'o2', name: 'Org 2' }], nextCursor: null })
      );
    const adapter = createGtApiAdapter({
      baseUrl: 'https://api.example.com',
    });

    const orgs = await adapter.listOrgs();

    expect(orgs.map((org) => org.id)).toEqual(['o1', 'o2']);
    expect(
      vi.mocked(listOrgs).mock.calls.map(([options]) => options.query)
    ).toEqual([{ cursor: undefined }, { cursor: 'next' }]);
  });

  it('creates a project API key with exactly the requested permissions', async () => {
    vi.mocked(createProjectApiKey).mockResolvedValue(
      result({
        apiKey: {
          id: 'key-id',
          name: 'Dev',
          key: 'gtx-secret',
          projectId: 'project-id',
          type: 'production' as const,
        },
      })
    );
    const adapter = createGtApiAdapter({
      baseUrl: 'https://api.example.com',
    });

    const { apiKey } = await adapter.createProjectApiKey('project-id', {
      name: 'Dev',
      permissions: ['project:translations:generate'],
    });

    expect(apiKey.key).toBe('gtx-secret');
    expect(createProjectApiKey).toHaveBeenCalledWith(
      expect.objectContaining({
        path: { projectId: 'project-id' },
        body: { name: 'Dev', permissions: ['project:translations:generate'] },
      })
    );
  });

  it('exposes raw job statuses alongside the normalized view', async () => {
    vi.mocked(getTranslationJobInfo).mockResolvedValue(
      result([{ jobId: 'job-id', status: 'failed', error: { message: null } }])
    );
    const adapter = createGtApiAdapter({
      baseUrl: 'https://api.example.com',
    });
    const controller = new AbortController();

    const raw = await adapter.loadJobStatuses(['job-id'], {
      signal: controller.signal,
    });
    const normalized = await adapter.checkJobStatus(['job-id']);

    expect(raw).toEqual([
      { jobId: 'job-id', status: 'failed', error: { message: null } },
    ]);
    expect(normalized).toEqual([
      { jobId: 'job-id', status: 'failed', error: { message: '' } },
    ]);
    expect(getTranslationJobInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { jobIds: ['job-id'] },
        signal: controller.signal,
      })
    );
  });

  it('sends only contract fields for publish and user-edit diffs', async () => {
    vi.mocked(publishFiles).mockResolvedValue(result({ results: [] }));
    vi.mocked(submitUserEditDiffs).mockResolvedValue(
      result({ filesProcessed: 1, entriesReceived: 1, message: 'ok' })
    );
    const adapter = createGtApiAdapter();
    adapter.configure({
      baseUrl: 'https://api.example.com',
      projectId: 'project-id',
      customMapping,
    });

    await adapter.publishFiles([
      {
        fileId: 'file-id',
        versionId: 'version-id',
        branchId: 'branch-id',
        publish: true,
        fileName: 'document.json',
      } as PublishFilesData['body']['files'][number],
    ]);
    await adapter.submitUserEditDiffs({
      projectId: 'project-id',
      diffs: [
        {
          fileName: 'document.json',
          locale: 'target',
          diff: '@@',
          branchId: 'branch-id',
          versionId: 'version-id',
          fileId: 'file-id',
          localContent: '{}',
        } as SubmitUserEditDiffsData['body']['diffs'][number],
      ],
    });

    const publishBody = vi.mocked(publishFiles).mock.calls[0][0]!.body;
    expect(publishBody.files[0]).toEqual({
      fileId: 'file-id',
      versionId: 'version-id',
      branchId: 'branch-id',
      publish: true,
    });
    const diffBody = vi.mocked(submitUserEditDiffs).mock.calls[0][0]!.body;
    expect(diffBody.diffs[0]).toEqual({
      diff: '@@',
      branchId: 'branch-id',
      versionId: 'version-id',
      fileId: 'file-id',
      localContent: '{}',
      locale: 'es-ES',
    });
  });

  it('updates files in the configured project, mapping translation locales in both directions', async () => {
    vi.mocked(updateFiles).mockResolvedValue(
      result({
        files: [
          {
            branchId: 'branch-id',
            fileId: 'page',
            versionId: 'v1',
            metadata: { previewUrl: 'https://example.com/page' },
          },
          {
            branchId: 'branch-id',
            fileId: 'page',
            versionId: 'v1',
            locale: 'es-ES',
            metadata: { previewUrl: 'https://example.com/es/page' },
          },
        ],
      }) as never
    );
    const adapter = createGtApiAdapter();
    adapter.configure({
      baseUrl: 'https://api.example.com',
      projectId: 'project-id',
      customMapping,
    });

    await expect(
      adapter.updateFiles([
        {
          fileId: 'page',
          versionId: 'v1',
          metadata: { previewUrl: 'https://example.com/page' },
        },
        {
          fileId: 'page',
          versionId: 'v1',
          locale: 'target',
          metadata: { previewUrl: 'https://example.com/es/page' },
        },
      ])
    ).resolves.toEqual({
      files: [
        {
          branchId: 'branch-id',
          fileId: 'page',
          versionId: 'v1',
          metadata: { previewUrl: 'https://example.com/page' },
        },
        {
          branchId: 'branch-id',
          fileId: 'page',
          versionId: 'v1',
          locale: 'target',
          metadata: { previewUrl: 'https://example.com/es/page' },
        },
      ],
    });
    expect(updateFiles).toHaveBeenCalledWith(
      expect.objectContaining({
        path: { projectId: 'project-id' },
        body: {
          files: [
            {
              fileId: 'page',
              versionId: 'v1',
              metadata: { previewUrl: 'https://example.com/page' },
            },
            {
              fileId: 'page',
              versionId: 'v1',
              locale: 'es-ES',
              metadata: { previewUrl: 'https://example.com/es/page' },
            },
          ],
        },
      })
    );
  });

  it('maps file-info locales in both directions', async () => {
    vi.mocked(getFileInfo).mockResolvedValue(
      result({
        sourceFiles: [
          {
            branchId: 'branch-id',
            fileId: 'file-id',
            versionId: 'version-id',
            fileName: 'document.html',
            fileFormat: 'HTML',
            dataFormat: null,
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01',
            publishedAt: null,
            locales: ['es-ES'],
            sourceLocale: 'en-US',
          },
        ],
        translatedFiles: [
          {
            branchId: 'branch-id',
            fileId: 'file-id',
            versionId: 'version-id',
            fileFormat: 'HTML',
            dataFormat: null,
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01',
            approvedAt: null,
            publishedAt: null,
            completedAt: null,
            locale: 'es-ES',
          },
        ],
      })
    );
    const adapter = createGtApiAdapter();
    adapter.configure({ baseUrl: 'https://api.example.com', customMapping });

    const response = await adapter.queryFileData({
      translatedFiles: [
        {
          branchId: 'branch-id',
          fileId: 'file-id',
          versionId: 'version-id',
          locale: 'target',
        },
      ],
    });

    expect(getFileInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          translatedFiles: [expect.objectContaining({ locale: 'es-ES' })],
        }),
      })
    );
    expect(response.translatedFiles[0].locale).toBe('target');
    expect(response.sourceFiles[0]).toMatchObject({
      sourceLocale: 'source',
      locales: ['target'],
    });
  });
});

describe.sequential('createGtApiAdapter uploadSourceFiles', () => {
  // One byte over the legacy route's 20MB inline limit.
  const largeContent = 'a'.repeat(20_000_001);
  const largeHash = bytesToHex(sha256(utf8ToBytes(largeContent)));
  const presigned = {
    url: 'https://bucket.example.com/staged',
    headers: { 'x-amz-checksum-sha256': 'checksum' },
    expiresAt: '2026-11-07T00:00:00.000Z',
  };
  const small = {
    content: '{"a":"A"}',
    fileName: 'en.json',
    fileFormat: 'JSON' as const,
    locale: 'source',
  };
  const large = {
    content: largeContent,
    fileName: '__INTERNAL_GT_TEMPLATE_NAME__',
    fileFormat: 'GTJSON' as const,
    locale: 'source',
    formatMetadata: { hash: { sourceCode: {} } },
  };
  const metadataBytes = utf8ToBytes(JSON.stringify(large.formatMetadata));
  const metadataHash = bytesToHex(sha256(metadataBytes));
  const metadataPresigned = { ...presigned, url: `${presigned.url}/metadata` };
  const uploaded = (fileName: string, fileFormat: 'JSON' | 'GTJSON') => ({
    branchId: 'branch-id',
    fileId: `${fileName}-id`,
    versionId: 'version-id',
    fileName,
    fileFormat,
  });

  const storageFetch = vi.fn<typeof fetch>();

  function configuredAdapter(withProjectId = true) {
    const adapter = createGtApiAdapter();
    adapter.configure({
      baseUrl: 'https://api.example.com',
      apiKey: 'api-key',
      fetch: storageFetch,
      retryPolicy: 'none',
      ...(withProjectId && { projectId: 'project-id' }),
      customMapping,
    });
    return adapter;
  }

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(uploadSourceFiles).mockResolvedValue(
      result({
        uploadedFiles: [{ ...uploaded('en.json', 'JSON'), locale: 'en-US' }],
        count: 1,
        message: 'Uploaded files',
      }) as never
    );
    vi.mocked(createFileUploads).mockResolvedValue(
      result({
        files: [
          { sha256: largeHash, status: 'upload_required', upload: presigned },
          {
            sha256: metadataHash,
            status: 'upload_required',
            upload: metadataPresigned,
          },
        ],
      }) as never
    );
    vi.mocked(uploadSourceFileReferences).mockResolvedValue(
      result({
        summary: { total: 1, succeeded: 1, failed: 0 },
        results: [
          {
            ...uploaded('__INTERNAL_GT_TEMPLATE_NAME__', 'GTJSON'),
            status: 'succeeded',
          },
        ],
      }) as never
    );
  });

  it('sends a file over the inline limit and its formatMetadata by reference, and the rest inline', async () => {
    const response = await configuredAdapter().uploadSourceFiles(
      [{ source: large }, { source: small }],
      { sourceLocale: 'source' }
    );

    expect(uploadSourceFiles).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          data: [
            {
              source: {
                ...small,
                content: btoa(small.content),
                locale: 'en-US',
              },
            },
          ],
          sourceLocale: 'en-US',
        },
      })
    );
    expect(createFileUploads).toHaveBeenCalledWith(
      expect.objectContaining({
        path: { projectId: 'project-id' },
        body: {
          files: [
            {
              sha256: largeHash,
              fileFormat: 'GTJSON',
              size: largeContent.length,
            },
            {
              sha256: metadataHash,
              fileFormat: 'JSON',
              size: metadataBytes.byteLength,
            },
          ],
        },
      })
    );
    expect(
      vi
        .mocked(putFileUpload)
        .mock.calls.map(([target, bytes]) => [
          target,
          bytesToHex(sha256(bytes)),
        ])
    ).toEqual([
      [presigned, largeHash],
      [metadataPresigned, metadataHash],
    ]);
    // The raw configured fetch, so storage never sees the API key.
    expect(
      vi.mocked(putFileUpload).mock.calls.map(([, , transport]) => transport)
    ).toEqual([
      { fetch: storageFetch, retryPolicy: 'none' },
      { fetch: storageFetch, retryPolicy: 'none' },
    ]);
    const {
      content: _content,
      formatMetadata: _metadata,
      ...largeSource
    } = large;
    expect(uploadSourceFileReferences).toHaveBeenCalledWith(
      expect.objectContaining({
        path: { projectId: 'project-id' },
        body: {
          data: [
            {
              source: {
                ...largeSource,
                locale: 'en-US',
                upload: { sha256: largeHash },
                formatMetadata: { upload: { sha256: metadataHash } },
              },
            },
          ],
          sourceLocale: 'en-US',
        },
      })
    );
    expect(response.uploadedFiles).toEqual([
      { ...uploaded('en.json', 'JSON'), locale: 'source' },
      uploaded('__INTERNAL_GT_TEMPLATE_NAME__', 'GTJSON'),
    ]);
  });

  it('skips the PUT when the project already stores the bytes', async () => {
    vi.mocked(createFileUploads).mockResolvedValue(
      result({
        files: [
          { sha256: largeHash, status: 'exists' },
          { sha256: metadataHash, status: 'exists' },
        ],
      }) as never
    );

    await configuredAdapter().uploadSourceFiles([{ source: large }], {
      sourceLocale: 'source',
    });

    expect(putFileUpload).not.toHaveBeenCalled();
    expect(uploadSourceFiles).not.toHaveBeenCalled();
    expect(uploadSourceFileReferences).toHaveBeenCalledOnce();
  });

  it('uploads only the content of a file without formatMetadata', async () => {
    const { formatMetadata: _metadata, ...withoutMetadata } = large;
    vi.mocked(createFileUploads).mockResolvedValue(
      result({
        files: [
          { sha256: largeHash, status: 'upload_required', upload: presigned },
        ],
      }) as never
    );

    await configuredAdapter().uploadSourceFiles([{ source: withoutMetadata }], {
      sourceLocale: 'source',
    });

    expect(
      vi.mocked(createFileUploads).mock.calls[0]![0].body.files
    ).toHaveLength(1);
    expect(
      vi.mocked(uploadSourceFileReferences).mock.calls[0]![0].body.data[0]!
        .source
    ).not.toHaveProperty('formatMetadata');
  });

  it('throws when the API reports the referenced file as failed', async () => {
    vi.mocked(uploadSourceFileReferences).mockResolvedValue(
      result({
        summary: { total: 1, succeeded: 0, failed: 1 },
        results: [
          {
            ...uploaded('__INTERNAL_GT_TEMPLATE_NAME__', 'GTJSON'),
            status: 'failed',
            error: 'uploaded file is larger than 150MB',
          },
        ],
      }) as never
    );

    await expect(
      configuredAdapter().uploadSourceFiles([{ source: large }], {
        sourceLocale: 'source',
      })
    ).rejects.toThrow('uploaded file is larger than 150MB');
  });

  it('keeps every file inline without a configured project ID', async () => {
    await configuredAdapter(false).uploadSourceFiles([{ source: large }], {
      sourceLocale: 'source',
    });

    expect(createFileUploads).not.toHaveBeenCalled();
    expect(uploadSourceFiles).toHaveBeenCalledOnce();
  });
});
