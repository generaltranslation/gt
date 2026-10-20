import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setTag } from '@generaltranslation/api';
import { GT } from '../index';

vi.mock('@generaltranslation/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@generaltranslation/api')>()),
  setTag: vi.fn(),
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

describe('GT adapter lifetime', () => {
  const tag = {
    id: 'id',
    tagId: 'release',
    message: null,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };
  const request = {
    files: [{ fileId: 'file-id', versionId: 'version-id' }],
  };

  beforeEach(() => {
    vi.mocked(setTag).mockResolvedValue(result({ created: true, tag }));
  });

  it('constructs one adapter per instance across calls', async () => {
    const projectId = 'lifetime-reuse';
    const instance = new GT({ apiKey: 'api-key', projectId });

    await instance.setTag('release', request);
    await instance.setTag('release', request);

    expect(adapterConstructions.get(projectId)).toHaveLength(1);
  });

  it('rebuilds the adapter after setConfig changes credentials', async () => {
    const projectId = 'lifetime-reconfigure';
    const instance = new GT({ apiKey: 'api-key', projectId });

    await instance.setTag('release', request);
    instance.setConfig({ apiKey: 'other-key' });
    await instance.setTag('release', request);

    expect(
      adapterConstructions.get(projectId)?.map((config) => config.apiKey)
    ).toEqual(['api-key', 'other-key']);
  });

  it('rebuilds the adapter when setConfig throws after writing credentials', async () => {
    const projectId = 'lifetime-failed-reconfigure';
    const instance = new GT({ apiKey: 'api-key', projectId });

    await instance.setTag('release', request);
    expect(() =>
      instance.setConfig({ apiKey: 'other-key', sourceLocale: '!' })
    ).toThrow();
    await instance.setTag('release', request);

    expect(
      adapterConstructions.get(projectId)?.map((config) => config.apiKey)
    ).toEqual(['api-key', 'other-key']);
  });
});
