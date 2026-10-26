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

  it('prioritizes a path locale when locale routing is enabled', () => {
    const conditionStore = new AsyncLocalConditionStore({
      ...config,
      localeRouting: true,
    });
    vi.mocked(getRequest).mockReturnValueOnce(
      createRequest({ locale: 'es', enableI18n: true, pathname: '/fr/about' })
    );

    expect(conditionStore.getLocale()).toBe('fr');
  });

  it('ignores path locales when locale routing is disabled', () => {
    const conditionStore = new AsyncLocalConditionStore(config);
    vi.mocked(getRequest).mockReturnValueOnce(
      createRequest({ locale: 'es', enableI18n: true, pathname: '/fr/about' })
    );

    expect(conditionStore.getLocale()).toBe('es');
  });

  it('resolves conditions once per Start request', () => {
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

  it('resolves each Start request to its own conditions', () => {
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
