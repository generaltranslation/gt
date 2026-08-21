import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-start', () => ({
  createIsomorphicFn: () => ({
    server: (serverFn: (...args: never[]) => unknown) => ({
      client: (clientFn: (...args: never[]) => unknown) =>
        Object.assign(serverFn, { client: clientFn, server: serverFn }),
    }),
  }),
}));

vi.mock('@tanstack/react-start/server', () => ({
  setCookie: vi.fn(),
}));

import {
  ReactI18nCache,
  initializeI18nConfig,
  setReactI18nCache,
} from '@generaltranslation/react-core/pure';
import { hashMessage } from 'gt-i18n/internal';
import { AsyncLocalConditionStore } from '../../condition-store/AsyncLocalConditionStore';
import {
  getConditionStore,
  setConditionStore,
} from '../../condition-store/singleton';
import { getGT, getMessages, getTranslations } from '../runtime';

type TestGlobal = typeof globalThis & {
  __generaltranslation?: unknown;
};

const config = {
  defaultLocale: 'en',
  locales: ['en', 'es'],
};

const failingLoader = () =>
  Promise.reject(new Error("Cannot find module './_gt/es.json'"));

function setup(cacheParams: ConstructorParameters<typeof ReactI18nCache>[0]) {
  initializeI18nConfig(config);
  setReactI18nCache(new ReactI18nCache(cacheParams));
  setConditionStore(new AsyncLocalConditionStore(config));
}

function runRequest<T>(callback: () => Promise<T>): Promise<T> {
  return getConditionStore().run(
    new Request('https://example.com', {
      headers: { cookie: 'generaltranslation.locale=es' },
    }),
    callback
  );
}

describe.sequential('server functions when translation loading fails', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
    consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('resolves translated content when the loader succeeds', async () => {
    setup({
      loadTranslations: async () => ({
        [hashMessage('Hello, world!', { $format: 'ICU' })]: 'Hola, mundo!',
      }),
    });

    await runRequest(async () => {
      const gt = await getGT();
      expect(gt('Hello, world!')).toBe('Hola, mundo!');
    });
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  it('development: getGT falls back to source content when the loader fails', async () => {
    // Same failure class as gt#1937: the cache rethrows in dev, which used to
    // reject the server function and turn the request into an HTTP 500
    vi.stubEnv('NODE_ENV', 'development');
    setup({ loadTranslations: failingLoader });

    await runRequest(async () => {
      const gt = await getGT();
      expect(gt('Hello, {name}!', { name: 'Alice' })).toBe('Hello, Alice!');
    });
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('"es"')
    );
  });

  it('development: getMessages falls back to source content when the loader fails', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    setup({ loadTranslations: failingLoader });

    await runRequest(async () => {
      const m = await getMessages();
      expect(m('Hello, world!')).toBe('Hello, world!');
    });
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
  });

  it('development: getTranslations falls back to the source dictionary when loaders fail', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    setup({
      dictionary: { greeting: 'Hello {name}!' },
      loadDictionary: failingLoader,
      loadTranslations: failingLoader,
    });

    await runRequest(async () => {
      const t = await getTranslations();
      expect(t('greeting', { name: 'Alice' })).toBe('Hello Alice!');
    });
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
  });

  it('development: a later request retries the loader and recovers', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    const loadTranslations = vi
      .fn()
      .mockRejectedValueOnce(new Error("Cannot find module './_gt/es.json'"))
      .mockResolvedValue({
        [hashMessage('Hello, world!', { $format: 'ICU' })]: 'Hola, mundo!',
      });
    setup({ loadTranslations });

    await runRequest(async () => {
      const gt = await getGT();
      expect(gt('Hello, world!')).toBe('Hello, world!');
    });
    await runRequest(async () => {
      const gt = await getGT();
      expect(gt('Hello, world!')).toBe('Hola, mundo!');
    });
    expect(loadTranslations).toHaveBeenCalledTimes(2);
  });

  it('production: the loader failure stays inside the cache and logs no warning', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    setup({ loadTranslations: failingLoader });

    await runRequest(async () => {
      const gt = await getGT();
      expect(gt('Hello, world!')).toBe('Hello, world!');
    });
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });
});
