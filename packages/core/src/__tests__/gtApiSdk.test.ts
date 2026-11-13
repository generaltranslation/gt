import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTag,
  getProjectInfo,
  uploadAssets,
  uploadTranslations,
} from '@generaltranslation/api';
import { GT } from '../index';

vi.mock('@generaltranslation/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@generaltranslation/api')>()),
  createTag: vi.fn(),
  getProjectInfo: vi.fn(),
  uploadAssets: vi.fn(),
  uploadTranslations: vi.fn(),
}));

// Adapter constructions are recorded per projectId; each test that inspects
// them owns a distinct project.
const adapterConstructions = vi.hoisted(
  () =>
    new Map<
      string | undefined,
      Array<{ apiKey?: string; userTokenProvider?: unknown }>
    >()
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

  it('canonicalizes the configured source locale for translation uploads', async () => {
    vi.mocked(uploadTranslations).mockResolvedValue(
      result({ uploadedFiles: [], count: 0, message: 'Uploaded files' })
    );
    const brandGt = new GT({
      apiKey: 'test-api-key',
      projectId: 'test-project',
      sourceLocale: 'brand-english',
      customMapping: {
        'brand-english': { code: 'en-US', name: 'Brand English' },
      },
    });
    const file = {
      content: '{}',
      fileName: 'messages.json',
      fileFormat: 'JSON' as const,
    };

    await brandGt.uploadTranslations(
      [
        {
          source: { ...file, content: '', locale: 'brand-english' },
          translations: [{ ...file, locale: 'fr' }],
        },
      ],
      { sourceLocale: 'brand-english' }
    );

    expect(uploadTranslations).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ sourceLocale: 'en-US' }),
      })
    );
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

  it('accepts a user token provider in place of an API key', async () => {
    const projectId = 'lifetime-user-token';
    const userTokenProvider = {
      getAccessToken: async () => 'user-token',
      refreshAccessToken: async () => undefined,
    };
    const instance = new GT({
      baseUrl: 'https://api.example.com',
      projectId,
      userTokenProvider,
    });

    await instance.createTag(request);

    expect(adapterConstructions.get(projectId)).toEqual([
      expect.objectContaining({ apiKey: undefined, userTokenProvider }),
    ]);
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
