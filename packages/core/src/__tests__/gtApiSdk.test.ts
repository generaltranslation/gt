import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTag,
  getProjectInfo,
  uploadAssets,
} from '@generaltranslation/api';
import { GT } from '../index';

vi.mock('@generaltranslation/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@generaltranslation/api')>()),
  createTag: vi.fn(),
  getProjectInfo: vi.fn(),
  uploadAssets: vi.fn(),
}));

// Tests in this file run concurrently, so constructions are recorded per
// projectId; each lifetime test owns a distinct project.
const adapterConstructions = vi.hoisted(
  () => new Map<string | undefined, Array<{ apiKey?: string }>>()
);

vi.mock('../adapter/createGtApi', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../adapter/createGtApi')>();
  const createGtApiAdapter: typeof actual.createGtApiAdapter = (config) => {
    const configs = adapterConstructions.get(config?.projectId) ?? [];
    adapterConstructions.set(config?.projectId, [...configs, config ?? {}]);
    return actual.createGtApiAdapter(config);
  };
  return { ...actual, createGtApiAdapter };
});

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

  it('strips autoApprove from getProjectData to match the published shape', async () => {
    vi.mocked(getProjectInfo).mockResolvedValue(
      result({
        id: 'project-id',
        name: 'Project',
        orgId: 'org-id',
        defaultLocale: 'en',
        currentLocales: ['es'],
        autoApprove: false,
      })
    );
    await expect(gt.getProjectData('project-id')).resolves.toEqual({
      id: 'project-id',
      name: 'Project',
      orgId: 'org-id',
      defaultLocale: 'en',
      currentLocales: ['es'],
    });
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

describe('GT adapter lifetime', () => {
  const tag = {
    id: 'id',
    tagId: 'release',
    message: null,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };
  const request = {
    tagId: 'release',
    files: [{ fileId: 'file-id', versionId: 'version-id' }],
  };

  beforeEach(() => {
    vi.mocked(createTag).mockResolvedValue(result({ tag }));
  });

  it('constructs one adapter per instance across calls', async () => {
    const projectId = 'lifetime-reuse';
    const instance = new GT({ apiKey: 'api-key', projectId });

    await instance.createTag(request);
    await instance.createTag(request);

    expect(adapterConstructions.get(projectId)).toHaveLength(1);
  });

  it('rebuilds the adapter after setConfig changes credentials', async () => {
    const projectId = 'lifetime-reconfigure';
    const instance = new GT({ apiKey: 'api-key', projectId });

    await instance.createTag(request);
    instance.setConfig({ apiKey: 'other-key' });
    await instance.createTag(request);

    expect(
      adapterConstructions.get(projectId)?.map((config) => config.apiKey)
    ).toEqual(['api-key', 'other-key']);
  });

  it('rebuilds the adapter when setConfig throws after writing credentials', async () => {
    const projectId = 'lifetime-failed-reconfigure';
    const instance = new GT({ apiKey: 'api-key', projectId });

    await instance.createTag(request);
    expect(() =>
      instance.setConfig({ apiKey: 'other-key', sourceLocale: '!' })
    ).toThrow();
    await instance.createTag(request);

    expect(
      adapterConstructions.get(projectId)?.map((config) => config.apiKey)
    ).toEqual(['api-key', 'other-key']);
  });
});
