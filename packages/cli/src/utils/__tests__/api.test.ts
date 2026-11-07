import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserTokenProvider } from '@generaltranslation/api';
import {
  configureCustomMapping,
  createClients,
  resolveCanonicalLocale,
} from '../api.js';

const userTokenProvider: UserTokenProvider = {
  getAccessToken: async () => 'user-token',
  refreshAccessToken: async () => undefined,
};

const settings = {
  apiKey: 'api-key',
  baseUrl: 'https://api.example.com',
  projectId: 'project-id',
};

describe('CLI API clients', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves configured aliases and spellings to standardized canonical locales', () => {
    configureCustomMapping({ 'brand-english': { code: 'en-US' } });

    expect(resolveCanonicalLocale('brand-english')).toBe('en-US');
    expect(resolveCanonicalLocale('en-us')).toBe('en-US');
  });

  it('keeps resolving with the configured custom mapping after the caller mutates it', () => {
    const customMapping = { 'brand-english': { code: 'en-US' } };
    configureCustomMapping(customMapping);
    customMapping['brand-english'].code = 'fr';

    expect(resolveCanonicalLocale('brand-english')).toBe('en-US');
  });

  it('maps query file locales between configured aliases and canonical locales', async () => {
    fetchMock.mockImplementation(async (request) => {
      const body = JSON.parse(await new Request(request).text()) as {
        files: Array<{ locale?: string }>;
      };
      expect(body.files[1].locale).toBe('en-US');
      return Response.json({
        results: [
          {
            status: 'found',
            fileId: 'file-id',
            sourceLocale: 'en-US',
            locales: ['en-US', 'es'],
          },
          { status: 'found', fileId: 'file-id', locale: 'en-US' },
        ],
      });
    });
    const { project } = createClients({
      ...settings,
      customMapping: { 'brand-english': { code: 'en-US' } },
    });

    const { results } = await project!.queryFiles([
      { branchId: 'branch-id', fileId: 'file-id', versionId: 'version-id' },
      {
        branchId: 'branch-id',
        fileId: 'file-id',
        versionId: 'version-id',
        locale: 'brand-english',
      },
    ]);

    expect(results[1].locale).toBe('brand-english');
    expect(results[0].sourceLocale).toBe('brand-english');
    expect(results[0].locales).toEqual(['brand-english', 'es']);
  });

  it('sends the API key, or else the user token', async () => {
    fetchMock.mockImplementation(async () =>
      Response.json({ items: [], nextCursor: null })
    );

    await createClients({
      ...settings,
      userTokenProvider,
    }).project!.listBranches();
    await createClients({
      ...settings,
      apiKey: undefined,
      userTokenProvider,
    }).project!.listBranches();

    expect(
      fetchMock.mock.calls.map(([request]) =>
        new Request(request).headers.get('authorization')
      )
    ).toEqual(['Bearer api-key', 'Bearer user-token']);
  });

  it('has no project client without a project ID', () => {
    const { project, account } = createClients({
      ...settings,
      projectId: undefined,
    });

    expect(project).toBeUndefined();
    expect(account).toBeDefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('has no account client for a project API key', () => {
    const { project, account } = createClients({
      ...settings,
      apiKey: 'gtx-api-project-key',
    });

    expect(project).toBeDefined();
    expect(account).toBeUndefined();
  });

  it('creates a project in the selected organization with a canonical default locale', async () => {
    fetchMock.mockImplementation(async (request) => {
      const req = new Request(request);
      expect(new URL(req.url).pathname).toBe('/v2/orgs/org-id/projects');
      expect(req.method).toBe('POST');
      const body = JSON.parse(await req.text()) as { defaultLocale: string };
      expect(body.defaultLocale).toBe('en-US');
      return Response.json(
        {
          project: {
            id: 'project-id',
            name: 'Project',
            orgId: 'org-id',
            defaultLocale: 'en-US',
          },
        },
        { status: 201 }
      );
    });
    const { account } = createClients({
      ...settings,
      projectId: undefined,
      customMapping: { 'brand-english': { code: 'en-us' } },
    });

    await account!.org('org-id').createProject({
      name: 'Project',
      defaultLocale: 'brand-english',
    });

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('creates a project key with exactly the requested permissions', async () => {
    let body: unknown;
    fetchMock.mockImplementation(async (request) => {
      const req = new Request(request);
      expect(new URL(req.url).pathname).toBe('/v2/projects/p1/api-keys');
      body = JSON.parse(await req.text());
      return Response.json(
        {
          apiKey: {
            id: 'key-id',
            name: 'Dev',
            key: 'gtx-secret',
            projectId: 'p1',
            type: 'production',
          },
        },
        { status: 201 }
      );
    });

    const result = await createClients({
      ...settings,
      projectId: 'p1',
    }).project!.createApiKey({
      name: 'Dev',
      permissions: ['project:translations:generate'],
    });

    expect(body).toEqual({
      name: 'Dev',
      permissions: ['project:translations:generate'],
    });
    expect(result.apiKey.key).toBe('gtx-secret');
  });
});
