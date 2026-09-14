import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTag,
  getProjectInfo,
  uploadAssets,
  uploadSourceFiles,
} from '@generaltranslation/api';
import { GT } from '../index';

vi.mock('@generaltranslation/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@generaltranslation/api')>()),
  createTag: vi.fn(),
  getProjectInfo: vi.fn(),
  uploadAssets: vi.fn(),
  uploadSourceFiles: vi.fn(),
}));

function result<T>(data: T) {
  return {
    data,
    request: new Request('https://api.example.com'),
    response: new Response(),
  };
}

const gt = new GT({
  apiKey: 'api-key',
  baseUrl: 'https://api.example.com',
  projectId: 'project-id',
});

describe('GT generated SDK transport', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('routes tag creation through the generated operation', async () => {
    const tag = {
      id: 'id',
      tagId: 'release',
      message: null,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    };
    vi.mocked(createTag).mockResolvedValue(result({ tag }));

    await expect(
      gt.createTag({
        tagId: 'release',
        files: [
          { fileId: 'file-id', versionId: 'version-id', branchId: 'branch-id' },
        ],
      })
    ).resolves.toEqual({ tag });

    expect(createTag).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ tagId: 'release' }),
      })
    );
  });

  it('enforces the published non-null defaultLocale instead of asserting it', async () => {
    const project = {
      id: 'project-id',
      name: 'Project',
      orgId: 'org-id',
      defaultLocale: null,
      currentLocales: ['es'],
      autoApprove: false,
    };
    vi.mocked(getProjectInfo).mockResolvedValue(result(project));

    await expect(gt.getProjectInfo()).rejects.toThrow(
      'without a default locale'
    );

    vi.mocked(getProjectInfo).mockResolvedValue(
      result({ ...project, defaultLocale: 'en' })
    );
    await expect(gt.getProjectData('project-id')).resolves.toEqual({
      id: 'project-id',
      name: 'Project',
      orgId: 'org-id',
      defaultLocale: 'en',
      currentLocales: ['es'],
    });
  });

  it('enforces branchId and a typed dataFormat on uploaded files', async () => {
    const uploaded = {
      fileId: 'file-id',
      versionId: 'version-id',
      fileName: 'doc.json',
      fileFormat: 'JSON' as const,
    };
    const file = {
      source: {
        content: '{}',
        fileName: 'doc.json',
        fileFormat: 'JSON' as const,
        locale: 'en',
      },
    };
    vi.mocked(uploadSourceFiles).mockResolvedValue(
      result({ uploadedFiles: [uploaded], count: 1, message: 'ok' })
    );

    await expect(
      gt.uploadSourceFiles([file], { sourceLocale: 'en' })
    ).rejects.toThrow('without a branch ID');

    vi.mocked(uploadSourceFiles).mockResolvedValue(
      result({
        uploadedFiles: [
          { ...uploaded, branchId: 'branch-id', dataFormat: 'ICU' },
          {
            ...uploaded,
            fileId: 'other',
            branchId: 'branch-id',
            dataFormat: 'NOT_A_FORMAT',
          },
        ],
        count: 2,
        message: 'ok',
      })
    );

    const response = await gt.uploadSourceFiles([file], {
      sourceLocale: 'en',
    });
    expect(response.uploadedFiles.map((f) => f.dataFormat)).toEqual([
      'ICU',
      undefined,
    ]);
    expect(response.uploadedFiles[0].branchId).toBe('branch-id');
  });

  it('returns the generated font asset shape without a deduped field', async () => {
    const asset = {
      id: 'asset-id',
      assetKey: 'font-key',
      fileName: 'font.woff2',
    };
    vi.mocked(uploadAssets).mockResolvedValue(
      result({ assets: [asset], count: 1 })
    );

    await expect(
      gt.uploadFonts([
        { assetType: 'FONT', content: 'base64', fileName: 'font.woff2' },
      ])
    ).resolves.toEqual({ assets: [asset], count: 1 });
  });
});
