import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GT } from 'generaltranslation';
import { I18NConfiguration } from '../I18NConfiguration';

const mockLoadTranslations = vi.hoisted(() => vi.fn());

vi.mock('../loadTranslation', () => ({
  loadTranslations: (...args: unknown[]) => mockLoadTranslations(...args),
}));

type ConfigParams = ConstructorParameters<typeof I18NConfiguration>[0];

function createConfig(overrides: Partial<ConfigParams> = {}) {
  return new I18NConfiguration({
    runtimeUrl: undefined,
    cacheUrl: null,
    loadTranslationsType: 'custom',
    loadDictionaryEnabled: false,
    defaultLocale: 'en',
    locales: ['en', 'fr'],
    renderSettings: {
      method: 'default',
    },
    maxConcurrentRequests: 100,
    maxBatchSize: 25,
    batchInterval: 50,
    headersAndCookies: {},
    _usingPlugin: false,
    ...overrides,
  });
}

describe('I18NConfiguration integration', () => {
  beforeEach(() => {
    mockLoadTranslations.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it.each([
    {
      loadTranslationsType: 'remote' as const,
      secondTranslation: 'Salut',
      loadCalls: 2,
    },
    {
      loadTranslationsType: 'custom' as const,
      secondTranslation: 'Bonjour',
      loadCalls: 1,
    },
  ])(
    'scopes cache expiry for $loadTranslationsType translations',
    async ({ loadTranslationsType, secondTranslation, loadCalls }) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      mockLoadTranslations
        .mockResolvedValueOnce({ hash: 'Bonjour' })
        .mockResolvedValueOnce({ hash: 'Salut' });
      const config = createConfig({
        loadTranslationsType,
        cacheExpiryTime: 100,
        cacheUrl: 'https://cache.example.com',
        projectId: 'project-id',
      });

      await expect(config.getCachedTranslations('fr')).resolves.toEqual({
        hash: 'Bonjour',
      });

      vi.advanceTimersByTime(101);

      await expect(config.getCachedTranslations('fr')).resolves.toEqual({
        hash: secondTranslation,
      });
      expect(mockLoadTranslations).toHaveBeenCalledTimes(loadCalls);
    }
  );

  it('does not forward dictionary config as runtime translation metadata', async () => {
    mockLoadTranslations.mockResolvedValue({});
    const translateMany = vi
      .spyOn(GT.prototype, 'translateMany')
      .mockImplementation((async (sources: Record<string, unknown>) => {
        return Object.fromEntries(
          Object.keys(sources).map((hash) => [
            hash,
            { success: true, translation: 'Bonjour' },
          ])
        );
      }) as GT['translateMany']);
    const config = createConfig({
      dictionary: './dictionary.json',
      projectId: 'project-id',
      description: 'Clinical UI',
      renderSettings: {
        method: 'replace',
        timeout: 4321,
      },
    });

    await expect(
      config.translate({
        source: 'Hello',
        targetLocale: 'fr',
        options: {
          $format: 'ICU',
        },
      })
    ).resolves.toBe('Bonjour');

    const metadata = translateMany.mock.calls[0][1] as Record<string, unknown>;
    expect(metadata).toMatchObject({
      sourceLocale: 'en',
      targetLocale: 'fr',
      projectId: 'project-id',
      publish: true,
      fast: true,
      description: 'Clinical UI',
      timeout: 4321,
    });
    expect(metadata).not.toHaveProperty('dictionary');
  });
});
