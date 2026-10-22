import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GT, GTIntl, GTRuntime, type ProjectHandle } from '../index';
import type { TranslateManyEntry } from '../types';

const numberValue = 1234.56;

const brandFrenchMapping = {
  'brand-french': {
    code: 'fr-FR',
    name: 'Brand French',
  },
};

const formatCurrencyWithIntl = (locale: string, currency = 'EUR') =>
  new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    numberingSystem: 'latn',
  }).format(numberValue);

describe.sequential('GT Translation Methods', () => {
  describe.each(['translate', 'translateMany'] as const)('%s', (method) => {
    const fetchMock = vi.fn<typeof fetch>();
    let project: ProjectHandle;

    beforeEach(() => {
      fetchMock.mockReset();
      vi.stubGlobal('fetch', fetchMock);
      project = new GT({
        apiKey: 'test-api-key',
        baseUrl: 'https://api.test.com',
        projectId: 'test-project',
        localeConfig: { defaultLocale: 'en' },
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('sends instance configuration and explicit translation metadata', async () => {
      const translated = {
        success: true,
        translation: 'Bonjour',
        locale: 'fr',
        dataFormat: 'ICU',
      } as const;
      fetchMock.mockResolvedValue(
        Response.json({
          translations: { greeting: translated },
          generated: true,
        })
      );
      const entry = {
        source: 'Hello {name}',
        metadata: { hash: 'greeting', id: 'welcome', dataFormat: 'ICU' },
      } satisfies TranslateManyEntry;
      const options = {
        targetLocale: 'fr',
        sourceLocale: 'en-US',
        modelProvider: 'OPENAI',
      };
      const result =
        method === 'translate'
          ? await project.translate(entry, options)
          : await project.translateMany([entry], options);

      expect(result).toEqual(
        method === 'translate' ? translated : [translated]
      );
      const [input, init] = fetchMock.mock.calls[0];
      const request = new Request(input, init);
      expect(request.url).toBe(
        'https://api.test.com/v2/projects/test-project/translate'
      );
      expect(request.headers.get('authorization')).toBe('Bearer test-api-key');
      expect(request.headers.has('gt-project-id')).toBe(false);
      expect(await request.json()).toMatchObject({
        requests: { greeting: entry },
        targetLocale: 'fr',
        sourceLocale: 'en-US',
        metadata: { modelProvider: 'OPENAI' },
      });
    });

    it('names the method when the target locale is missing', async () => {
      const withoutTarget = new GT({
        apiKey: 'test-api-key',
        projectId: 'test-project',
      });
      const result =
        method === 'translate'
          ? withoutTarget.translate('Hello', '')
          : withoutTarget.translateMany(['Hello'], '');

      await expect(result).rejects.toThrow(
        `GT Error: Cannot call \`${method}\` without a target locale. Pass the target locale to \`${method}()\`.`
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('propagates network failures', async () => {
      const error = new Error('Translation service unavailable');
      fetchMock.mockRejectedValue(error);
      const result =
        method === 'translate'
          ? project.translate('Hello', 'es')
          : project.translateMany(['Hello'], 'es');

      await expect(result).rejects.toBe(error);
    });
  });
});

describe('GTIntl', () => {
  it('resolves canonical and alias locales through customMapping', () => {
    const intl = new GTIntl({
      customMapping: {
        'custom-locale': { code: 'en-US', name: 'Custom English' },
        named: 'Named',
      },
    });

    expect(intl.resolveCanonicalLocale('custom-locale')).toBe('en-US');
    expect(intl.resolveCanonicalLocale('named')).toBe('named');
    expect(intl.resolveCanonicalLocale('fr-FR')).toBe('fr-FR');
    expect(intl.resolveAliasLocale('en-US')).toBe('custom-locale');
    expect(intl.resolveAliasLocale('zh-CN')).toBe('zh-CN');
  });

  it('formats a custom alias, as the instance locale or per call, in its canonical locale', () => {
    const localeConfig = {
      defaultLocale: 'en-US',
      customMapping: brandFrenchMapping,
    };

    expect(
      new GTIntl(localeConfig, { locale: 'brand-french' }).formatCurrency(
        numberValue,
        'EUR'
      )
    ).toBe(formatCurrencyWithIntl('fr-FR'));
    expect(
      new GTIntl(localeConfig).formatCurrency(numberValue, 'EUR', {
        locale: 'brand-french',
      })
    ).toBe(formatCurrencyWithIntl('fr-FR'));
  });
});

describe.sequential('GT scopes', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const userTokenProvider = {
    getAccessToken: async () => 'token',
    refreshAccessToken: async () => undefined,
  };

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it.each([
    [
      'GT projectId',
      (id: unknown) =>
        new GT({ apiKey: 'key', projectId: id as string }) as unknown,
    ],
    [
      'GT project',
      (id: unknown) => new GT({ apiKey: 'key' }).project(id as string),
    ],
    [
      'GTRuntime projectId',
      (id: unknown) =>
        new GTRuntime({ apiKey: 'key', projectId: id as string }),
    ],
  ])('%s rejects empty, blank and non-string IDs', (_label, create) => {
    for (const id of ['', '   ', 123, null]) {
      expect(() => create(id)).toThrow(
        'GT Error: The project ID must be a non-empty string. Pass the project ID.'
      );
    }
  });

  it('GT org rejects empty, blank and non-string IDs', () => {
    for (const id of ['', '   ', 123, undefined, null]) {
      expect(() => new GT({ apiKey: 'key' }).org(id as string)).toThrow(
        'GT Error: The organization ID must be a non-empty string. Pass the organization ID.'
      );
    }
  });

  it('requires projectId with a project API key', () => {
    expect(() => new GT({ apiKey: 'gtx-api-123' })).toThrow(
      'GT Error: A project API key needs a project ID. Pass `projectId` to `new GT()` with this key, or use an organization key or user token for account operations.'
    );
    expect(new GT({ apiKey: 'gtx-api-123', projectId: 'prj' }).projectId).toBe(
      'prj'
    );
  });

  it('accepts organization keys, unknown keys and user tokens without projectId, sending no request', () => {
    for (const account of [
      new GT({ apiKey: 'gtx-org-123' }),
      new GT({ apiKey: 'key' }),
      new GT({ userTokenProvider }),
    ]) {
      account.project('prj');
      account.org('org');
    }

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not read GT_API_KEY', () => {
    vi.stubEnv('GT_API_KEY', 'env-key');

    expect(
      new GTRuntime({ userTokenProvider, projectId: 'prj' }).apiKey
    ).toBeUndefined();
  });

  it('constructs a project-scoped GT with every project method', () => {
    const gt = new GT({ apiKey: 'key', projectId: 'prj' });

    expect(gt.projectId).toBe('prj');
    expect(gt).toBeInstanceOf(GTRuntime);
    expect(typeof gt.uploadSourceFiles).toBe('function');
    expect('project' in gt).toBe(false);
    expect('listOrgs' in gt).toBe(false);
  });

  it('returns created projects under the requested locale identity', async () => {
    const requests: Request[] = [];
    fetchMock.mockImplementation(async (input, init) => {
      requests.push(new Request(input, init));
      return Response.json({
        project: {
          id: 'prj',
          name: 'Project',
          orgId: 'org',
          defaultLocale: 'en-US',
        },
      });
    });
    const org = new GT({
      apiKey: 'key',
      localeConfig: { customMapping: { source: { code: 'en-US' } } },
    }).org('org');

    await expect(
      org.createProject({ name: 'Project', defaultLocale: 'source' })
    ).resolves.toEqual({
      project: {
        id: 'prj',
        name: 'Project',
        orgId: 'org',
        defaultLocale: 'source',
      },
    });
    expect(requests).toHaveLength(1);
    expect(await requests[0].json()).toMatchObject({
      defaultLocale: 'en-US',
    });
  });

  it('creates a project API key in one request', async () => {
    const requests: Request[] = [];
    const apiKey = {
      id: 'key-id',
      name: 'Dev',
      key: 'gtx-api-secret',
      projectId: 'prj',
      type: 'production',
    };
    fetchMock.mockImplementation(async (input, init) => {
      requests.push(new Request(input, init));
      return Response.json({ apiKey }, { status: 201 });
    });
    const body = {
      name: 'Dev',
      permissions: ['project:translations:generate' as const],
    };

    await expect(
      new GT({
        apiKey: 'gtx-org-key',
        baseUrl: 'https://api.example.com',
        projectId: 'prj',
      }).createApiKey(body)
    ).resolves.toEqual({ apiKey });
    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe('POST');
    expect(new URL(requests[0].url).pathname).toBe('/v2/projects/prj/api-keys');
    expect(await requests[0].json()).toEqual(body);
  });

  it('returns frozen instances and handles', () => {
    const account = new GT({ apiKey: 'key' });

    expect(Object.isFrozen(account)).toBe(true);
    expect(Object.isFrozen(account.project('prj'))).toBe(true);
    expect(Object.isFrozen(account.org('org'))).toBe(true);
    expect(Object.isFrozen(new GT({ apiKey: 'key', projectId: 'prj' }))).toBe(
      true
    );
    expect(
      Object.isFrozen(new GTRuntime({ apiKey: 'key', projectId: 'prj' }))
    ).toBe(true);
  });

  it.each([
    [
      'GTRuntime',
      (localeConfig: object) =>
        new GTRuntime({ apiKey: 'key', projectId: 'prj', localeConfig }),
    ],
    [
      'project-scoped GT',
      (localeConfig: object) =>
        new GT({ apiKey: 'key', projectId: 'prj', localeConfig }),
    ],
    [
      'account project',
      (localeConfig: object) =>
        new GT({ apiKey: 'key', localeConfig }).project('prj'),
    ],
  ])(
    '%s keeps a deeply frozen copy of its locale configuration',
    (_label, create) => {
      const input = {
        defaultLocale: 'en',
        locales: ['en', 'spanish'],
        customMapping: { spanish: { code: 'es' } },
      };
      const instance = create(input);
      const { localeConfig } = instance;
      input.locales.push('fr');
      input.customMapping.spanish.code = 'de';

      expect(() => {
        (instance as { apiKey?: string }).apiKey = 'other';
      }).toThrow(TypeError);
      expect(() => (localeConfig.locales as string[]).push('fr')).toThrow(
        TypeError
      );
      expect(() => {
        (localeConfig.customMapping as Record<string, unknown>).spanish = {
          code: 'de',
        };
      }).toThrow(TypeError);
      expect(() => {
        (localeConfig.customMapping!.spanish as { code: string }).code = 'de';
      }).toThrow(TypeError);
      expect(localeConfig).toEqual({
        defaultLocale: 'en',
        locales: ['en', 'spanish'],
        customMapping: { spanish: { code: 'es' } },
      });
    }
  );
});
