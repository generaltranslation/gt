import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AsyncResource } from 'node:async_hooks';
import { initializeI18nConfig } from 'gt-i18n/internal';

let getLocale: typeof import('../getLocale').getLocale;
let getRegion: typeof import('../getRegion').getRegion;
let registerLocale: typeof import('../registerLocale').registerLocale;

const request = vi.hoisted(() => ({
  headers: new Headers(),
  cookies: new Map<string, string>(),
  getLocale: vi.fn<() => Promise<string>>(),
  getRegion: vi.fn<() => Promise<string | undefined>>(),
}));

vi.mock('next/headers', () => ({
  headers: async () => request.headers,
  cookies: async () => ({
    get: (name: string) => {
      const value = request.cookies.get(name);
      return value === undefined ? undefined : { value };
    },
  }),
}));

vi.mock('gt-next/internal/_getLocale', () => ({
  getLocale: request.getLocale,
}));

vi.mock('gt-next/internal/_getRegion', () => ({
  getRegion: request.getRegion,
}));

describe('request conditions', () => {
  const originalConfig = process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS;
  const originalCustomLocale =
    process.env._GENERALTRANSLATION_CUSTOM_GET_LOCALE_ENABLED;
  const originalCustomRegion =
    process.env._GENERALTRANSLATION_CUSTOM_GET_REGION_ENABLED;

  beforeEach(async () => {
    request.headers = new Headers();
    request.cookies.clear();
    request.getLocale.mockReset();
    request.getRegion.mockReset();
    delete process.env._GENERALTRANSLATION_CUSTOM_GET_LOCALE_ENABLED;
    delete process.env._GENERALTRANSLATION_CUSTOM_GET_REGION_ENABLED;
    process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS = '{}';
    initializeI18nConfig({
      defaultLocale: 'en',
      locales: ['en', 'fr', 'es'],
    });
    await loadRequestFunctions();
  });

  afterEach(() => {
    restoreEnv('_GENERALTRANSLATION_I18N_CONFIG_PARAMS', originalConfig);
    restoreEnv(
      '_GENERALTRANSLATION_CUSTOM_GET_LOCALE_ENABLED',
      originalCustomLocale
    );
    restoreEnv(
      '_GENERALTRANSLATION_CUSTOM_GET_REGION_ENABLED',
      originalCustomRegion
    );
  });

  it('resolves locale candidates from the header, cookie, and browser preferences', async () => {
    request.headers = new Headers({
      'x-generaltranslation-locale': 'de',
      'accept-language': 'es;q=0.9',
    });
    request.cookies.set('generaltranslation.locale', 'fr');

    await expect(getLocale()).resolves.toBe('fr');
  });

  it('honors configured header and cookie names', async () => {
    process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS = JSON.stringify({
      headersAndCookies: {
        localeHeaderName: 'x-app-locale',
        localeCookieName: 'app-locale',
      },
    });
    request.headers = new Headers({ 'x-app-locale': 'es' });
    request.cookies.set('app-locale', 'fr');
    await loadRequestFunctions();

    await expect(getLocale()).resolves.toBe('es');
  });

  it('parses request configuration once', async () => {
    const source = JSON.stringify({
      headersAndCookies: { localeHeaderName: 'x-cached-locale' },
    });
    process.env._GENERALTRANSLATION_I18N_CONFIG_PARAMS = source;
    request.headers = new Headers({ 'x-cached-locale': 'fr' });
    const parse = vi.spyOn(JSON, 'parse');
    await loadRequestFunctions();

    await expect(getLocale()).resolves.toBe('fr');
    await expect(getLocale()).resolves.toBe('fr');

    expect(parse.mock.calls.filter(([value]) => value === source)).toHaveLength(
      1
    );
    parse.mockRestore();
  });

  it('delegates to configured request functions', async () => {
    process.env._GENERALTRANSLATION_CUSTOM_GET_LOCALE_ENABLED = 'true';
    process.env._GENERALTRANSLATION_CUSTOM_GET_REGION_ENABLED = 'true';
    request.getLocale.mockResolvedValue('fr');
    request.getRegion.mockResolvedValue('CA');
    await loadRequestFunctions();

    await expect(getLocale()).resolves.toBe('fr');
    await expect(getRegion()).resolves.toBe('CA');
  });

  it('reads the default region cookie directly', async () => {
    request.cookies.set('generaltranslation.region', 'US');

    await expect(getRegion()).resolves.toBe('US');
  });

  it('isolates registered locales across overlapping request contexts', async () => {
    const releaseFirst = createDeferred<void>();

    const first = runInRequestScope(async () => {
      registerLocale('fr');
      await releaseFirst.promise;
      return getLocale();
    });

    const second = runInRequestScope(async () => {
      registerLocale('es');
      releaseFirst.resolve();
      await Promise.resolve();
      return getLocale();
    });

    await expect(Promise.all([first, second])).resolves.toEqual(['fr', 'es']);
  });
});

async function loadRequestFunctions(): Promise<void> {
  vi.resetModules();
  const [localeModule, regionModule, registerLocaleModule] = await Promise.all([
    import('../getLocale'),
    import('../getRegion'),
    import('../registerLocale'),
  ]);
  getLocale = localeModule.getLocale;
  getRegion = regionModule.getRegion;
  registerLocale = registerLocaleModule.registerLocale;
}

function runInRequestScope<Result>(fn: () => Promise<Result>): Promise<Result> {
  const resource = new AsyncResource('gt-next-test-request');
  const result = resource.runInAsyncScope(fn);
  return result.finally(() => resource.emitDestroy());
}

function createDeferred<Value>() {
  let resolve!: (value: Value | PromiseLike<Value>) => void;
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
