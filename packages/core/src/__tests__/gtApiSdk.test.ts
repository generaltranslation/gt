import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTag, uploadAssets } from '@generaltranslation/api';
import { GT } from '../index';

vi.mock('@generaltranslation/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@generaltranslation/api')>()),
  createTag: vi.fn(),
  uploadAssets: vi.fn(),
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
