import { hashMessageTree } from 'generaltranslation/id';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type GTContextType, useGTContext } from '../../context/context';
import { useEnableI18n, useLocale } from '../../hooks/condition-store';
import type { ReactI18nCache } from '../../i18n-cache/ReactI18nCache';
import { setReactI18nCache } from '../../i18n-cache/singleton-operations';
import { initializeI18nConfig } from '../../setup/i18nConfig';
import {
  OVERRIDE_LOAD_MAX_RETENTION_MS,
  OVERRIDE_LOAD_RETRY_DELAY_MS,
  useGT,
} from '../useGT';

// One mounted component: useMemo keeps its value while the deps are equal,
// useRef keeps its object, and effects run when a test commits a render.
const hooks = vi.hoisted(() => ({
  memo: undefined as { deps: unknown[]; value: unknown } | undefined,
  ref: undefined as { current: unknown } | undefined,
  effects: [] as (() => void)[],
}));
vi.mock('react', () => ({
  useMemo: <T>(factory: () => T, deps: unknown[]): T => {
    const memo = hooks.memo;
    if (memo && memo.deps.every((dep, i) => Object.is(dep, deps[i]))) {
      return memo.value as T;
    }
    const value = factory();
    hooks.memo = { deps, value };
    return value;
  },
  useRef: <T>(initial: T): { current: T } =>
    (hooks.ref ??= { current: initial }) as { current: T },
  useEffect: (effect: () => void) => {
    hooks.effects.push(effect);
  },
}));

/** Commits the last render: React runs its effects. */
function commitRender(): void {
  for (const effect of hooks.effects.splice(0)) effect();
}

/** Starts another instance of the component, with its own hooks. */
function mountAnother(): void {
  hooks.memo = undefined;
  hooks.ref = undefined;
  hooks.effects = [];
}

vi.mock('../../context/context', () => ({
  useGTContext: vi.fn(),
}));

vi.mock('../../hooks/condition-store', () => ({
  useLocale: vi.fn(),
  useEnableI18n: vi.fn(),
}));

type TestGlobal = typeof globalThis & { __generaltranslation?: unknown };

const name = 'Ada';
const helloHash = hashMessageTree(['Hello, ', ['name'], '!']);
const frenchHello = ['Bonjour, ', ['name'], ' !'];
const lookupTranslationByHash = vi.fn();
const loadTranslations = vi.fn();
// Locales the fake I18nCache holds as loaded and unexpired.
const loadedLocales = new Set<string>();
const loadFrench = async (locale: string) => {
  await Promise.resolve();
  loadedLocales.add(locale);
  return {};
};

function catchThrown(render: () => unknown): unknown {
  try {
    render();
  } catch (thrown) {
    return thrown;
  }
  throw new Error('Expected render to throw');
}

describe('react-core/unstable useGT', () => {
  beforeEach(() => {
    Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
    initializeI18nConfig({ defaultLocale: 'en', locales: ['en', 'fr'] }, 'SPA');
    mountAnother();
    loadedLocales.clear();
    lookupTranslationByHash
      .mockReset()
      .mockImplementation((locale: string, hash: string) =>
        loadedLocales.has(locale) && hash === helloHash
          ? frenchHello
          : undefined
      );
    loadTranslations.mockReset().mockImplementation(loadFrench);
    // A fresh cache object also resets useGT's per-cache override loads.
    setReactI18nCache({
      hasTranslations: (locale: string) => loadedLocales.has(locale),
      lookupTranslationByHash,
      loadTranslations,
    } as unknown as ReactI18nCache);
    vi.mocked(useLocale).mockReturnValue('fr');
    vi.mocked(useEnableI18n).mockReturnValue(true);
    vi.mocked(useGTContext).mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Same cases as I18nCache's dialect and custom-alias locale resolution.
  it.each([
    { name: 'dialect', locale: 'fr-FR', snapshotLocale: 'fr' },
    {
      name: 'alias',
      locale: 'en-GB',
      snapshotLocale: 'brand-british',
      config: {
        defaultLocale: 'en-US',
        locales: ['en-US', 'en'],
        customMapping: { 'brand-british': { code: 'en-GB' } },
      },
    },
  ])(
    'resolves a $name override to the configured snapshot locale',
    ({ locale, snapshotLocale, config }) => {
      if (config) {
        Reflect.deleteProperty(
          globalThis as TestGlobal,
          '__generaltranslation'
        );
        initializeI18nConfig(config, 'SPA');
      }
      vi.mocked(useGTContext).mockReturnValue({
        translationsSnapshot: {
          [snapshotLocale]: { [helloHash]: frenchHello },
        },
      } as unknown as GTContextType);
      const gt = useGT();

      expect(gt({ locale })`Hello, ${{ name }}!`).toBe('Bonjour, Ada !');
    }
  );

  it('reads the I18nCache only without a provider', () => {
    lookupTranslationByHash.mockImplementation((locale, hash) =>
      locale === 'fr' && hash === helloHash ? frenchHello : undefined
    );

    expect(useGT()`Hello, ${{ name }}!`).toBe('Bonjour, Ada !');
  });

  it('ignores source-locale snapshot entries when i18n is disabled', () => {
    vi.mocked(useLocale).mockReturnValue('en');
    vi.mocked(useEnableI18n).mockReturnValue(false);
    vi.mocked(useGTContext).mockReturnValue({
      translationsSnapshot: { en: {}, fr: { [helloHash]: frenchHello } },
    } as unknown as GTContextType);
    const gt = useGT();

    expect(gt({ locale: 'fr' })`Hello, ${{ name }}!`).toBe('Hello, Ada!');
  });

  it('reads a locale override from the snapshot on a default-locale render', () => {
    vi.mocked(useLocale).mockReturnValue('en');
    vi.mocked(useGTContext).mockReturnValue({
      translationsSnapshot: { fr: { [helloHash]: frenchHello } },
    } as unknown as GTContextType);
    const gt = useGT();

    expect(gt`Hello, ${{ name }}!`).toBe('Hello, Ada!');
    expect(gt({ locale: 'fr' })`Hello, ${{ name }}!`).toBe('Bonjour, Ada !');
    expect(loadTranslations).not.toHaveBeenCalled();
  });

  function renderFrenchOverride(context?: Partial<GTContextType>) {
    vi.mocked(useLocale).mockReturnValue('en');
    vi.mocked(useGTContext).mockReturnValue(context as GTContextType);
    const gt = useGT();
    return () => gt({ locale: 'fr-FR' })`Hello, ${{ name }}!`;
  }

  it.each([
    {
      name: 'under a provider that never hydrates',
      context: {
        translationsSnapshot: { en: {} },
        canLoadOverrideLocales: true,
      },
    },
    { name: 'without a provider', context: undefined },
  ])(
    'suspends on a locale override until the cache loads it, $name',
    async ({ context }) => {
      const render = renderFrenchOverride(context);

      const suspended = catchThrown(render);
      expect(suspended).toBeInstanceOf(Promise);
      // Retries before the load settles see the same promise.
      expect(catchThrown(render)).toBe(suspended);
      await suspended;

      expect(render()).toBe('Bonjour, Ada !');
      expect(loadTranslations).toHaveBeenCalledTimes(1);
      expect(loadTranslations).toHaveBeenCalledWith('fr');
    }
  );

  it('renders the source for an override missing from a hydrating provider', () => {
    const render = renderFrenchOverride({ translationsSnapshot: { en: {} } });

    expect(render()).toBe('Hello, Ada!');
    expect(loadTranslations).not.toHaveBeenCalled();
  });

  it('prefers the cache to the kept load, using that load only until the retry delay passes', async () => {
    vi.useFakeTimers();
    const salut = ['Salut, ', ['name'], ' !'];
    loadTranslations.mockImplementation(async (locale: string) => {
      await loadFrench(locale);
      return { [helloHash]: salut };
    });
    const render = renderFrenchOverride();
    await catchThrown(render);
    expect(render()).toBe('Bonjour, Ada !');

    loadedLocales.delete('fr');
    expect(render()).toBe('Salut, Ada !');

    vi.advanceTimersByTime(OVERRIDE_LOAD_RETRY_DELAY_MS);
    const reload = catchThrown(render);
    expect(reload).toBeInstanceOf(Promise);
    await reload;

    expect(render()).toBe('Bonjour, Ada !');
    expect(loadTranslations).toHaveBeenCalledTimes(2);
  });

  it('throws a failed load until the retry delay passes, then retries', async () => {
    vi.useFakeTimers();
    const error = new Error('offline');
    loadTranslations.mockRejectedValueOnce(error);
    const render = renderFrenchOverride();

    await catchThrown(render);
    expect(catchThrown(render)).toBe(error);
    expect(catchThrown(render)).toBe(error);
    expect(loadTranslations).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(OVERRIDE_LOAD_RETRY_DELAY_MS);
    const retry = catchThrown(render);
    expect(retry).toBeInstanceOf(Promise);
    await retry;

    expect(render()).toBe('Bonjour, Ada !');
    expect(loadTranslations).toHaveBeenCalledTimes(2);
  });

  it('renders a load the cache expired at once until the retry delay passes', async () => {
    vi.useFakeTimers();
    // cacheExpiryTime: 0 resolves the catalog but never keeps it.
    loadTranslations.mockResolvedValue({ [helloHash]: frenchHello });
    const render = renderFrenchOverride();

    await catchThrown(render);
    expect(render()).toBe('Bonjour, Ada !');
    expect(render()).toBe('Bonjour, Ada !');
    expect(loadTranslations).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(OVERRIDE_LOAD_RETRY_DELAY_MS);
    await catchThrown(render);
    expect(render()).toBe('Bonjour, Ada !');
    expect(loadTranslations).toHaveBeenCalledTimes(2);
  });

  it('keeps each expired-at-once override until a render that needs several can finish', async () => {
    vi.useFakeTimers();
    Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
    initializeI18nConfig(
      { defaultLocale: 'en', locales: ['en', 'fr', 'de'] },
      'SPA'
    );
    setReactI18nCache({
      hasTranslations: () => false,
      lookupTranslationByHash: () => undefined,
      loadTranslations,
    } as unknown as ReactI18nCache);
    // cacheExpiryTime: 0, and each load outlasts the retry delay.
    const germanHello = ['Hallo, ', ['name'], '!'];
    const loadTime = OVERRIDE_LOAD_RETRY_DELAY_MS * 2;
    loadTranslations.mockImplementation(
      (locale: string) =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                [helloHash]: locale === 'fr' ? frenchHello : germanHello,
              }),
            loadTime
          )
        )
    );
    vi.mocked(useLocale).mockReturnValue('en');
    const gt = useGT();
    const render = () => [
      gt({ locale: 'fr' })`Hello, ${{ name }}!`,
      gt({ locale: 'de' })`Hello, ${{ name }}!`,
    ];

    // Each Suspense retry gets one step further, as React would retry.
    catchThrown(render);
    await vi.advanceTimersByTimeAsync(loadTime);
    catchThrown(render);
    await vi.advanceTimersByTimeAsync(loadTime);

    expect(render()).toEqual(['Bonjour, Ada !', 'Hallo, Ada!']);
    expect(loadTranslations).toHaveBeenCalledTimes(2);
  });

  it('keeps each override the cache expires sooner than the next load until a render that needs several can finish', async () => {
    vi.useFakeTimers();
    Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
    initializeI18nConfig(
      { defaultLocale: 'en', locales: ['en', 'fr', 'de'] },
      'SPA'
    );
    const germanHello = ['Hallo, ', ['name'], '!'];
    const catalogs: Record<string, Record<string, unknown>> = {
      fr: { [helloHash]: frenchHello },
      de: { [helloHash]: germanHello },
    };
    // A positive cacheExpiryTime shorter than each load.
    const cacheExpiryTime = 1_000;
    const loadTime = OVERRIDE_LOAD_RETRY_DELAY_MS * 2;
    const loadedAt = new Map<string, number>();
    const isCached = (locale: string) =>
      Date.now() < (loadedAt.get(locale) ?? -Infinity) + cacheExpiryTime;
    loadTranslations.mockImplementation(
      (locale: string) =>
        new Promise((resolve) =>
          setTimeout(() => {
            loadedAt.set(locale, Date.now());
            resolve(catalogs[locale]);
          }, loadTime)
        )
    );
    setReactI18nCache({
      hasTranslations: isCached,
      lookupTranslationByHash: (locale: string, hash: string) =>
        isCached(locale) ? catalogs[locale][hash] : undefined,
      loadTranslations,
    } as unknown as ReactI18nCache);
    vi.mocked(useLocale).mockReturnValue('en');
    const gt = useGT();
    const render = () => [
      gt({ locale: 'fr' })`Hello, ${{ name }}!`,
      gt({ locale: 'de' })`Hello, ${{ name }}!`,
    ];

    // Each Suspense retry gets one step further, as React would retry.
    catchThrown(render);
    await vi.advanceTimersByTimeAsync(loadTime);
    catchThrown(render);
    await vi.advanceTimersByTimeAsync(loadTime);

    expect(render()).toEqual(['Bonjour, Ada !', 'Hallo, Ada!']);
    expect(loadTranslations).toHaveBeenCalledTimes(2);
  });

  it('keeps the overrides a GT read past the retention limit until a render that needs several can finish', async () => {
    vi.useFakeTimers();
    Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
    const locales = ['fr', 'de', 'es', 'it'];
    initializeI18nConfig(
      { defaultLocale: 'en', locales: ['en', ...locales] },
      'SPA'
    );
    setReactI18nCache({
      hasTranslations: () => false,
      lookupTranslationByHash: () => undefined,
      loadTranslations,
    } as unknown as ReactI18nCache);
    // French settles a full retention limit before Italian does.
    const loadTime = OVERRIDE_LOAD_MAX_RETENTION_MS / (locales.length - 1);
    loadTranslations.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ [helloHash]: frenchHello }), loadTime)
        )
    );
    vi.mocked(useLocale).mockReturnValue('en');
    const gt = useGT();
    const render = () =>
      locales.map((locale) => gt({ locale })`Hello, ${{ name }}!`);

    // Each Suspense retry gets one step further, as React would retry.
    for (const _locale of locales) {
      catchThrown(render);
      await vi.advanceTimersByTimeAsync(loadTime);
    }

    expect(render()).toEqual(locales.map(() => 'Bonjour, Ada !'));
    expect(loadTranslations).toHaveBeenCalledTimes(locales.length);
  });

  it('renders the source for two slow failing overrides instead of reloading them in turn', async () => {
    vi.useFakeTimers();
    Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
    initializeI18nConfig(
      { defaultLocale: 'en', locales: ['en', 'fr', 'de'] },
      'SPA'
    );
    setReactI18nCache({
      hasTranslations: () => false,
      lookupTranslationByHash: () => undefined,
      loadTranslations,
    } as unknown as ReactI18nCache);
    // Both loads fail (I18nCache resolves {}) and outlast the retry delay.
    const loadTime = OVERRIDE_LOAD_RETRY_DELAY_MS * 2;
    loadTranslations.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({}), loadTime))
    );
    vi.mocked(useLocale).mockReturnValue('en');
    const gt = useGT();
    const render = () => [
      gt({ locale: 'fr' })`Hello, ${{ name }}!`,
      gt({ locale: 'de' })`Hello, ${{ name }}!`,
    ];

    catchThrown(render);
    await vi.advanceTimersByTimeAsync(loadTime);
    catchThrown(render);
    await vi.advanceTimersByTimeAsync(loadTime);

    expect(render()).toEqual(['Hello, Ada!', 'Hello, Ada!']);
    expect(loadTranslations).toHaveBeenCalledTimes(2);
  });

  it('retries a swallowed failure on time while another override loads', async () => {
    vi.useFakeTimers();
    Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
    initializeI18nConfig(
      { defaultLocale: 'en', locales: ['en', 'fr', 'de'] },
      'SPA'
    );
    setReactI18nCache({
      hasTranslations: () => false,
      lookupTranslationByHash: () => undefined,
      loadTranslations,
    } as unknown as ReactI18nCache);
    // French fails (I18nCache resolves {}); German loads slowly.
    const loadTime = OVERRIDE_LOAD_RETRY_DELAY_MS * 2;
    loadTranslations.mockImplementation((locale: string) =>
      locale === 'fr'
        ? Promise.resolve({})
        : new Promise((resolve) =>
            setTimeout(() => resolve({ [helloHash]: frenchHello }), loadTime)
          )
    );
    vi.mocked(useLocale).mockReturnValue('en');
    const gt = useGT();
    const french = () => gt({ locale: 'fr' })`Hello, ${{ name }}!`;
    const german = () => gt({ locale: 'de' })`Hello, ${{ name }}!`;

    await catchThrown(french);
    expect(french()).toBe('Hello, Ada!');
    // French is still current when German starts, so German keeps it.
    catchThrown(german);
    await vi.advanceTimersByTimeAsync(loadTime);
    expect(french()).toBe('Hello, Ada!');

    // A German load started after French expired must not keep it.
    await vi.advanceTimersByTimeAsync(OVERRIDE_LOAD_RETRY_DELAY_MS);
    catchThrown(german);
    await vi.advanceTimersByTimeAsync(loadTime);
    expect(catchThrown(french)).toBeInstanceOf(Promise);
    expect(loadTranslations).toHaveBeenCalledTimes(4);
  });

  it('retries a swallowed failure within the retention limit while other overrides keep loading', async () => {
    vi.useFakeTimers();
    Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
    const others = ['de', 'es', 'it', 'ja', 'ko', 'nl', 'pl', 'pt', 'sv', 'tr'];
    initializeI18nConfig(
      { defaultLocale: 'en', locales: ['en', 'fr', ...others] },
      'SPA'
    );
    setReactI18nCache({
      hasTranslations: () => false,
      lookupTranslationByHash: () => undefined,
      loadTranslations,
    } as unknown as ReactI18nCache);
    // French fails (I18nCache resolves {}); each other load overlaps the next.
    const loadTime = OVERRIDE_LOAD_RETRY_DELAY_MS + 1_000;
    loadTranslations.mockImplementation((locale: string) =>
      locale === 'fr'
        ? Promise.resolve({})
        : new Promise((resolve) => setTimeout(() => resolve({}), loadTime))
    );
    vi.mocked(useLocale).mockReturnValue('en');
    // Each read is another component instance.
    const read = (locale: string) => () => {
      mountAnother();
      return useGT()({ locale })`Hello, ${{ name }}!`;
    };

    const start = Date.now();
    await catchThrown(read('fr'));
    // Every load starts while French is current, so each one keeps it again.
    for (const locale of others) {
      catchThrown(read(locale));
      await vi.advanceTimersByTimeAsync(4_000);
    }

    expect(Date.now() - start).toBeGreaterThan(OVERRIDE_LOAD_MAX_RETENTION_MS);
    expect(catchThrown(read('fr'))).toBeInstanceOf(Promise);
  });

  it('retries a swallowed failure within the retention limit after later committed renders', async () => {
    vi.useFakeTimers();
    Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
    const others = ['de', 'es', 'it', 'ja', 'ko', 'nl', 'pl', 'pt', 'sv', 'tr'];
    initializeI18nConfig(
      { defaultLocale: 'en', locales: ['en', 'fr', ...others] },
      'SPA'
    );
    setReactI18nCache({
      hasTranslations: (locale: string) => loadedLocales.has(locale),
      lookupTranslationByHash,
      loadTranslations,
    } as unknown as ReactI18nCache);
    // French fails once (I18nCache resolves {}), then its loader recovers.
    let frenchLoads = 0;
    loadTranslations.mockImplementation(async (locale: string) => {
      await Promise.resolve();
      if (locale === 'fr' && frenchLoads++ === 0) return {};
      loadedLocales.add(locale);
      return {};
    });
    vi.mocked(useLocale).mockReturnValue('en');
    // Each render calls useGT again; the memoized GT survives, as in React.
    const renderIn = (locale: string) =>
      useGT()({ locale })`Hello, ${{ name }}!`;
    const commit = async (locale: string) => {
      catchThrown(() => renderIn(locale));
      await vi.advanceTimersByTimeAsync(0);
      const text = renderIn(locale);
      commitRender();
      return text;
    };

    expect(await commit('fr')).toBe('Hello, Ada!');
    // Every few seconds a committed render selects another locale.
    for (const locale of others) {
      await vi.advanceTimersByTimeAsync(4_000);
      expect(await commit(locale)).toBe('Bonjour, Ada !');
    }

    // Only the first render read French, so later loads kept it no longer
    // than the retention limit and it loads again.
    expect(await commit('fr')).toBe('Bonjour, Ada !');
    expect(frenchLoads).toBe(2);
  });

  it("keeps an unfinished update's override when a re-render reuses it", async () => {
    vi.useFakeTimers();
    Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
    initializeI18nConfig(
      { defaultLocale: 'en', locales: ['en', 'fr', 'de'] },
      'SPA'
    );
    setReactI18nCache({
      hasTranslations: () => false,
      lookupTranslationByHash: () => undefined,
      loadTranslations,
    } as unknown as ReactI18nCache);
    // Each load outlasts the retention limit.
    const loadTime = OVERRIDE_LOAD_MAX_RETENTION_MS + 10_000;
    loadTranslations.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ [helloHash]: frenchHello }), loadTime)
        )
    );
    vi.mocked(useLocale).mockReturnValue('en');
    const hello = (locale: string) => useGT()({ locale })`Hello, ${{ name }}!`;

    catchThrown(() => hello('fr'));
    await vi.advanceTimersByTimeAsync(loadTime);
    expect(hello('fr')).toBe('Bonjour, Ada !');
    // A render-phase update runs the component again; it reuses the memoized
    // French text and reads only German.
    catchThrown(() => hello('de'));
    await vi.advanceTimersByTimeAsync(loadTime);

    // The retry reads both, and French was kept for this unfinished update.
    expect([hello('fr'), hello('de')]).toEqual([
      'Bonjour, Ada !',
      'Bonjour, Ada !',
    ]);
    expect(loadTranslations).toHaveBeenCalledTimes(2);
  });

  it('does not revive an expired override when another override settles', async () => {
    vi.useFakeTimers();
    Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
    initializeI18nConfig(
      { defaultLocale: 'en', locales: ['en', 'fr', 'de'] },
      'SPA'
    );
    setReactI18nCache({
      hasTranslations: () => false,
      lookupTranslationByHash: () => undefined,
      loadTranslations,
    } as unknown as ReactI18nCache);
    // cacheExpiryTime: 0, so every catalog lives only in useGT's loads.
    loadTranslations.mockResolvedValue({ [helloHash]: frenchHello });
    vi.mocked(useLocale).mockReturnValue('en');
    const gt = useGT();
    const french = () => gt({ locale: 'fr' })`Hello, ${{ name }}!`;
    const german = () => gt({ locale: 'de' })`Hello, ${{ name }}!`;

    await catchThrown(french);
    expect(french()).toBe('Bonjour, Ada !');

    vi.advanceTimersByTime(OVERRIDE_LOAD_RETRY_DELAY_MS + 1);
    const salut = ['Salut, ', ['name'], ' !'];
    loadTranslations.mockResolvedValue({ [helloHash]: salut });
    await catchThrown(german);

    const reload = catchThrown(french);
    expect(reload).toBeInstanceOf(Promise);
    await reload;
    expect(french()).toBe('Salut, Ada !');
  });

  it('renders the source after a load the cache swallowed, without reloading', async () => {
    vi.useFakeTimers();
    // In production I18nCache logs a failed load and resolves {}.
    loadTranslations.mockResolvedValueOnce({});
    const render = renderFrenchOverride();

    await catchThrown(render);
    expect(render()).toBe('Hello, Ada!');
    expect(render()).toBe('Hello, Ada!');
    expect(loadTranslations).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(OVERRIDE_LOAD_RETRY_DELAY_MS);
    await catchThrown(render);
    expect(render()).toBe('Bonjour, Ada !');
  });
});
