import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setTag } from '@generaltranslation/api';
import { GT } from '../index';

const clientConstructions = vi.hoisted(() => ({ count: 0 }));

vi.mock('@generaltranslation/api', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@generaltranslation/api')>();
  return {
    ...actual,
    setTag: vi.fn(),
    createApiClient: ((config) => {
      clientConstructions.count += 1;
      return actual.createApiClient(config);
    }) satisfies typeof actual.createApiClient,
  };
});

function result<T>(data: T) {
  return {
    data,
    request: new Request('https://api.example.com'),
    response: new Response(),
  };
}

describe('GT API client lifetime', () => {
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

  it('constructs one API client per project, reused across its calls', async () => {
    const project = new GT({ apiKey: 'api-key', projectId: 'project-a' });

    await project.setTag('release', request);
    await project.setTag('release', request);

    expect(clientConstructions.count).toBe(1);
  });
});
