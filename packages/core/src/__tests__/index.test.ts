import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  GeneralTranslation,
  GTAccount,
  GTIntl,
  type ProjectHandle,
  type TranslateManyEntry,
} from '../index';
import { GTRuntime } from '../runtime';

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

describe.sequential('GeneralTranslation Translation Methods', () => {
  describe.each(['translate', 'translateMany'] as const)('%s', (method) => {
    const fetchMock = vi.fn<typeof fetch>();
    let project: ProjectHandle;

    beforeEach(() => {
      fetchMock.mockReset();
      vi.stubGlobal('fetch', fetchMock);
      project = new GeneralTranslation({
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
      const { success: _success, ...succeeded } = translated;
      fetchMock.mockResolvedValue(
        Response.json({ results: [{ status: 'succeeded', ...succeeded }] })
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
        requests: [entry],
        targetLocale: 'fr',
        sourceLocale: 'en-US',
        metadata: { modelProvider: 'OPENAI' },
      });
    });

    it('names the method when the target locale is missing', async () => {
      const withoutTarget = new GeneralTranslation({
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
  it.each(['Mars/Olympus', ''])(
    'rejects the time zone %j, which Intl does not know',
    (timeZone) => {
      expect(() => new GTIntl({ timeZone })).toThrow(
        `Invalid time zone ${JSON.stringify(timeZone)}`
      );
    }
  );

  it('formats dates and times in its time zone unless the call names one', () => {
    const intl = new GTIntl({ defaultLocale: 'en-US', timeZone: 'Asia/Tokyo' });
    const date = new Date('2020-05-06T14:03:02Z');
    const format = (timeZone: string) =>
      new Intl.DateTimeFormat('en-US', { timeStyle: 'short', timeZone }).format(
        date
      );

    expect(intl.formatDateTime(date, { timeStyle: 'short' })).toBe(
      format('Asia/Tokyo')
    );
    expect(
      intl.formatDateTime(date, { timeStyle: 'short', timeZone: 'UTC' })
    ).toBe(format('UTC'));
  });

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

describe.sequential('GeneralTranslation scopes', () => {
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
      'GeneralTranslation projectId',
      (id: unknown) =>
        new GeneralTranslation({
          apiKey: 'key',
          projectId: id as string,
        }) as unknown,
    ],
    [
      'GeneralTranslation project',
      (id: unknown) =>
        new GeneralTranslation({ apiKey: 'key' }).project(id as string),
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

  it('GeneralTranslation org rejects empty, blank and non-string IDs', () => {
    for (const id of ['', '   ', 123, undefined, null]) {
      expect(() =>
        new GeneralTranslation({ apiKey: 'key' }).org(id as string)
      ).toThrow(
        'GT Error: The organization ID must be a non-empty string. Pass the organization ID.'
      );
    }
  });

  it('requires projectId with a project API key', () => {
    expect(() => new GeneralTranslation({ apiKey: 'gtx-api-123' })).toThrow(
      'GT Error: A project API key needs a project ID. Pass `projectId` to `new GeneralTranslation()` with this key, or use an organization key or user token for account operations.'
    );
    expect(
      new GeneralTranslation({ apiKey: 'gtx-api-123', projectId: 'prj' })
        .projectId
    ).toBe('prj');
  });

  it('accepts organization keys, unknown keys and user tokens without projectId, sending no request', () => {
    for (const account of [
      new GeneralTranslation({ apiKey: 'gtx-org-123' }),
      new GeneralTranslation({ apiKey: 'key' }),
      new GeneralTranslation({ userTokenProvider }),
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

  it('constructs a project-scoped GeneralTranslation with every project method', () => {
    const gt = new GeneralTranslation({ apiKey: 'key', projectId: 'prj' });

    expect(gt.projectId).toBe('prj');
    expect(gt).toBeInstanceOf(GTRuntime);
    expect(typeof gt.uploadSourceFiles).toBe('function');
    expect('project' in gt).toBe(false);
    expect('listOrgs' in gt).toBe(false);
  });

  it('is an instance of GeneralTranslation in either scope', () => {
    expect(
      new GeneralTranslation({ apiKey: 'key', projectId: 'prj' })
    ).toBeInstanceOf(GeneralTranslation);
    expect(new GeneralTranslation({ apiKey: 'key' })).toBeInstanceOf(
      GeneralTranslation
    );
    expect({}).not.toBeInstanceOf(GeneralTranslation);
  });

  it('is account-scoped when projectId is undefined', () => {
    const projectId: string | undefined = undefined;

    expect(new GeneralTranslation({ apiKey: 'key', projectId })).toBeInstanceOf(
      GTAccount
    );
  });

  it('returns created projects under the requested locale identity', async () => {
    const requests: Request[] = [];
    fetchMock.mockImplementation(async (input, init) => {
      requests.push(new Request(input, init));
      return Response.json({
        id: 'prj',
        name: 'Project',
        orgId: 'org',
        defaultLocale: 'en-US',
      });
    });
    const org = new GeneralTranslation({
      apiKey: 'key',
      localeConfig: { customMapping: { source: { code: 'en-US' } } },
    }).org('org');

    await expect(
      org.createProject({ name: 'Project', defaultLocale: 'source' })
    ).resolves.toEqual({
      id: 'prj',
      name: 'Project',
      orgId: 'org',
      defaultLocale: 'source',
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
      permissions: ['project:translations:generate'],
      createdAt: '2026-01-01T00:00:00.000Z',
      lastUsedAt: null,
    };
    fetchMock.mockImplementation(async (input, init) => {
      requests.push(new Request(input, init));
      return Response.json(apiKey, { status: 201 });
    });
    const body = {
      name: 'Dev',
      permissions: ['project:translations:generate' as const],
    };

    await expect(
      new GeneralTranslation({
        apiKey: 'gtx-org-key',
        baseUrl: 'https://api.example.com',
        projectId: 'prj',
      }).createApiKey(body)
    ).resolves.toEqual(apiKey);
    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe('POST');
    expect(new URL(requests[0].url).pathname).toBe('/v2/projects/prj/api-keys');
    expect(await requests[0].json()).toEqual(body);
  });

  it('creates an organization API key in one request', async () => {
    const requests: Request[] = [];
    const apiKey = {
      id: 'key-id',
      name: 'CI',
      key: 'gtx-org-secret',
      permissions: ['org:context:read'],
      createdAt: '2026-01-01T00:00:00.000Z',
      lastUsedAt: null,
    };
    fetchMock.mockImplementation(async (input, init) => {
      requests.push(new Request(input, init));
      return Response.json(apiKey, { status: 201 });
    });
    const body = {
      name: 'CI',
      permissions: ['org:context:read' as const],
    };

    await expect(
      new GeneralTranslation({
        userTokenProvider: { getAccessToken: async () => 'token' },
        baseUrl: 'https://api.example.com',
      })
        .org('org')
        .createApiKey(body)
    ).resolves.toEqual(apiKey);
    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe('POST');
    expect(new URL(requests[0].url).pathname).toBe('/v2/orgs/org/api-keys');
    expect(await requests[0].json()).toEqual(body);
  });

  it('returns frozen instances and handles', () => {
    const account = new GeneralTranslation({ apiKey: 'key' });

    expect(Object.isFrozen(account)).toBe(true);
    expect(Object.isFrozen(account.project('prj'))).toBe(true);
    expect(Object.isFrozen(account.org('org'))).toBe(true);
    expect(
      Object.isFrozen(
        new GeneralTranslation({ apiKey: 'key', projectId: 'prj' })
      )
    ).toBe(true);
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
      'project-scoped GeneralTranslation',
      (localeConfig: object) =>
        new GeneralTranslation({
          apiKey: 'key',
          projectId: 'prj',
          localeConfig,
        }),
    ],
    [
      'account project',
      (localeConfig: object) =>
        new GeneralTranslation({ apiKey: 'key', localeConfig }).project('prj'),
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
