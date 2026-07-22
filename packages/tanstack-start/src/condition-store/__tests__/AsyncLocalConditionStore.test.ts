import { describe, expect, it, vi } from 'vitest';
import { initializeI18nConfig } from '@generaltranslation/react-core/pure';
import { AsyncLocalConditionStore } from '../AsyncLocalConditionStore';

vi.mock('@tanstack/react-start/server', () => ({
  setCookie: vi.fn(),
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
  it('reports whether the current execution has a request scope', () => {
    const conditionStore = new AsyncLocalConditionStore(config);

    expect(conditionStore.hasActiveScope()).toBe(false);
    conditionStore.run(createRequest({ locale: 'fr', enableI18n: true }), () =>
      expect(conditionStore.hasActiveScope()).toBe(true)
    );
    expect(conditionStore.hasActiveScope()).toBe(false);
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

  it('throws when conditions are read outside a request scope', () => {
    const conditionStore = new AsyncLocalConditionStore(config);

    expect(() => conditionStore.getLocale()).toThrow(
      'Cannot read GT request state outside a request scope'
    );
  });
});
