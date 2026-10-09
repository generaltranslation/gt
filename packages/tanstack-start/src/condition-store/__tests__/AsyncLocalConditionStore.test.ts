import { describe, expect, it, vi } from 'vitest';
import { initializeI18nConfig } from '@generaltranslation/react-core/pure';
import { getRequest, setCookie } from '@tanstack/react-start/server';
import { AsyncLocalConditionStore } from '../AsyncLocalConditionStore';

vi.mock('@tanstack/react-start/server', () => ({
  setCookie: vi.fn(),
  getRequest: vi.fn(() => {
    throw new Error('No StartEvent found in AsyncLocalStorage.');
  }),
}));

const config = {
  defaultLocale: 'en',
  locales: ['en', 'fr', 'es'],
};

initializeI18nConfig(config);

function createRequest({
  locale,
  region,
  enableI18n,
  pathname = '/',
}: {
  locale: string;
  region?: string;
  enableI18n: boolean;
  pathname?: string;
}) {
  const cookies = [
    `generaltranslation.locale=${locale}`,
    `generaltranslation.enable-i18n=${String(enableI18n)}`,
  ];
  if (region) cookies.push(`generaltranslation.region=${region}`);
  return new Request(`https://example.com${pathname}`, {
    headers: { cookie: cookies.join('; ') },
  });
}

describe('AsyncLocalConditionStore', () => {
  it('reports whether its config enables locale routing', () => {
    expect(
      new AsyncLocalConditionStore({
        ...config,
        localeRouting: true,
      }).isLocaleRoutingEnabled()
    ).toBe(true);
    expect(new AsyncLocalConditionStore(config).isLocaleRoutingEnabled()).toBe(
      false
    );
  });

  it('isolates conditions between concurrent requests', async () => {
    const conditionStore = new AsyncLocalConditionStore(config);
    let releaseFirstRequest!: () => void;
    const firstRequestPending = new Promise<void>((resolve) => {
      releaseFirstRequest = resolve;
    });

    const firstRequest = conditionStore.run(
      createRequest({ locale: 'fr', region: 'FR', enableI18n: true }),
      async () => {
        await firstRequestPending;
        return {
          locale: conditionStore.getLocale(),
          region: conditionStore.getRegion(),
          enableI18n: conditionStore.getEnableI18n(),
        };
      }
    );

    const secondRequest = conditionStore.run(
      createRequest({ locale: 'es', region: 'MX', enableI18n: false }),
      async () => ({
        locale: conditionStore.getLocale(),
        region: conditionStore.getRegion(),
        enableI18n: conditionStore.getEnableI18n(),
      })
    );

    await expect(secondRequest).resolves.toEqual({
      locale: 'es',
      region: 'MX',
      enableI18n: false,
    });

    releaseFirstRequest();
    await expect(firstRequest).resolves.toEqual({
      locale: 'fr',
      region: 'FR',
      enableI18n: true,
    });
  });

  it('prioritizes a path locale when locale routing is enabled', () => {
    const conditionStore = new AsyncLocalConditionStore({
      ...config,
      localeRouting: true,
    });

    conditionStore.run(
      createRequest({
        locale: 'es',
        enableI18n: true,
        pathname: '/ignored',
      }),
      () => expect(conditionStore.getLocale()).toBe('fr'),
      '/fr/about'
    );
  });

  it('ignores path locales when locale routing is disabled', () => {
    const conditionStore = new AsyncLocalConditionStore(config);

    conditionStore.run(
      createRequest({
        locale: 'es',
        enableI18n: true,
        pathname: '/fr/about',
      }),
      () => expect(conditionStore.getLocale()).toBe('es')
    );
  });

  it('resolves conditions once from the Start request without middleware', () => {
    const conditionStore = new AsyncLocalConditionStore(config);
    const request = createRequest({
      locale: 'fr',
      region: 'FR',
      enableI18n: false,
    });
    vi.mocked(getRequest).mockReturnValue(request);
    vi.mocked(setCookie).mockClear();

    expect(conditionStore.getLocale()).toBe('fr');
    expect(conditionStore.getRegion()).toBe('FR');
    expect(conditionStore.getEnableI18n()).toBe(false);
    expect(setCookie).toHaveBeenCalledTimes(1);

    vi.mocked(getRequest).mockReset();
  });

  it('resolves each Start request to its own conditions without middleware', () => {
    const conditionStore = new AsyncLocalConditionStore(config);
    const frenchRequest = createRequest({ locale: 'fr', enableI18n: true });
    const spanishRequest = createRequest({ locale: 'es', enableI18n: false });
    vi.mocked(setCookie).mockClear();

    vi.mocked(getRequest).mockReturnValue(frenchRequest);
    expect(conditionStore.getLocale()).toBe('fr');
    vi.mocked(getRequest).mockReturnValue(spanishRequest);
    expect(conditionStore.getLocale()).toBe('es');
    expect(conditionStore.getEnableI18n()).toBe(false);
    vi.mocked(getRequest).mockReturnValue(frenchRequest);
    expect(conditionStore.getLocale()).toBe('fr');
    expect(conditionStore.getEnableI18n()).toBe(true);

    // Repeated reads reuse each request's resolved conditions.
    expect(setCookie).toHaveBeenCalledTimes(2);

    vi.mocked(getRequest).mockReset();
  });

  it('retries the Start request after a failed lookup', () => {
    const conditionStore = new AsyncLocalConditionStore(config);
    vi.mocked(getRequest).mockImplementationOnce(() => {
      throw new Error('No StartEvent found in AsyncLocalStorage.');
    });

    expect(() => conditionStore.getLocale()).toThrow(
      /^gt-tanstack-start Error: Cannot read GT request state outside a request scope/
    );

    vi.mocked(getRequest).mockReturnValueOnce(
      createRequest({ locale: 'es', enableI18n: true })
    );
    expect(conditionStore.getLocale()).toBe('es');

    vi.mocked(getRequest).mockReset();
  });

  it('throws when conditions are read outside a request scope', () => {
    vi.mocked(getRequest).mockImplementation(() => {
      throw new Error('No StartEvent found in AsyncLocalStorage.');
    });
    const conditionStore = new AsyncLocalConditionStore(config);

    expect(() => conditionStore.getLocale()).toThrow(
      'Cannot read GT request state outside a request scope'
    );
  });
});
