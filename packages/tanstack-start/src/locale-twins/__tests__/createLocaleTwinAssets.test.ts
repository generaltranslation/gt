import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeI18nConfig } from '@generaltranslation/react-core/pure';
import type { LocaleTwinManifest } from 'generaltranslation/types';
import { getRequest, setCookie } from '@tanstack/react-start/server';
import { AsyncLocalConditionStore } from '../../condition-store/AsyncLocalConditionStore';
import { setConditionStore } from '../../condition-store/singleton';
import {
  createLocaleTwinAssets,
  type LocaleTwinAssetTransform,
} from '../createLocaleTwinAssets';

vi.mock('@tanstack/react-start/server', () => ({
  getRequest: vi.fn(),
  setCookie: vi.fn(),
}));

const manifest: LocaleTwinManifest = {
  version: 1,
  defaultLocale: 'en',
  locales: ['en', 'fr', 'es'],
  twinned: ['assets/index-Ab12.js', 'assets/home-Cd34.js'],
  entries: ['assets/index-Ab12.js'],
  versions: { en: '11111111', fr: '22222222', es: '33333333' },
  twins: {
    en: {
      'assets/index-Ab12.js': 'assets/index-Ab12.en-11111111.js',
      'assets/home-Cd34.js': 'assets/home-Cd34.en-11111111.js',
    },
    fr: {
      'assets/index-Ab12.js': 'assets/index-Ab12.fr-22222222.js',
      'assets/home-Cd34.js': 'assets/home-Cd34.fr-22222222.js',
    },
    es: {
      'assets/index-Ab12.js': 'assets/index-Ab12.es-33333333.js',
      'assets/home-Cd34.js': 'assets/home-Cd34.es-33333333.js',
    },
  },
};

const gtConfig = { defaultLocale: 'en', locales: ['en', 'fr', 'es'] };

function request(path: string, headers: Record<string, string> = {}) {
  return new Request(`https://example.com${path}`, { headers });
}

function frenchRequest(path = '/') {
  return request(path, { cookie: 'generaltranslation.locale=fr' });
}

function createTransform(
  assets: ReturnType<typeof createLocaleTwinAssets>,
  req: Request
): Promise<LocaleTwinAssetTransform> {
  return Promise.resolve(
    assets.createTransform({ warmup: false, request: req })
  );
}

function resetGlobals() {
  Reflect.deleteProperty(globalThis, '__generaltranslation');
}

/** What the server initialization does, with fresh singletons. */
function initializeServerGT(
  config: typeof gtConfig & { localeRouting?: boolean }
): AsyncLocalConditionStore {
  resetGlobals();
  initializeI18nConfig(config);
  const store = new AsyncLocalConditionStore(config);
  setConditionStore(store);
  return store;
}

describe.sequential('createLocaleTwinAssets', () => {
  beforeEach(() => {
    resetGlobals();
    vi.clearAllMocks();
  });
  afterEach(resetGlobals);

  describe('with GT initialized on the server', () => {
    beforeEach(() => {
      initializeServerGT(gtConfig);
    });

    it('maps the entry script and module preloads to the request locale twins', async () => {
      const transform = await createTransform(
        createLocaleTwinAssets({ manifest }),
        frenchRequest()
      );

      expect(
        await transform({ url: '/assets/index-Ab12.js', kind: 'script' })
      ).toBe('/assets/index-Ab12.fr-22222222.js');
      expect(
        await transform({ url: '/assets/home-Cd34.js', kind: 'script' })
      ).toBe('/assets/home-Cd34.fr-22222222.js');
    });

    it('keeps the base path, CDN origin, query and hash of each URL', async () => {
      const transform = await createTransform(
        createLocaleTwinAssets({ manifest }),
        frenchRequest()
      );

      expect(
        transform({ url: '/app/assets/index-Ab12.js?v=1', kind: 'script' })
      ).toBe('/app/assets/index-Ab12.fr-22222222.js?v=1');
      expect(
        transform({
          url: 'https://cdn.example.com/assets/home-Cd34.js#x',
          kind: 'script',
        })
      ).toBe('https://cdn.example.com/assets/home-Cd34.fr-22222222.js#x');
    });

    it('leaves shared scripts, stylesheets and CSS URLs unchanged', async () => {
      const transform = await createTransform(
        createLocaleTwinAssets({ manifest }),
        frenchRequest()
      );

      expect(transform({ url: '/assets/vendor-Ef56.js', kind: 'script' })).toBe(
        '/assets/vendor-Ef56.js'
      );
      expect(
        transform({ url: '/other/index-Ab12.js.map', kind: 'script' })
      ).toBe('/other/index-Ab12.js.map');
      expect(
        transform({ url: '/assets/index-Ab12.js', kind: 'stylesheet' })
      ).toBe('/assets/index-Ab12.js');
      expect(transform({ url: '/assets/index-Ab12.js', kind: 'css-url' })).toBe(
        '/assets/index-Ab12.js'
      );
    });

    it('supports the asset contexts of older TanStack Start versions', async () => {
      const transform = await createTransform(
        createLocaleTwinAssets({ manifest }),
        frenchRequest()
      );

      for (const ctx of [
        { url: '/assets/index-Ab12.js', type: 'clientEntry' },
        { url: '/assets/index-Ab12.js', type: 'modulepreload' },
        { url: '/assets/index-Ab12.js', kind: 'clientEntry' },
        { url: '/assets/index-Ab12.js', kind: 'modulepreload' },
      ]) {
        expect(transform(ctx)).toBe('/assets/index-Ab12.fr-22222222.js');
      }
      expect(
        transform({ url: '/assets/index-Ab12.js', type: 'stylesheet' })
      ).toBe('/assets/index-Ab12.js');
    });

    it('creates a transform per request and never caches across requests', async () => {
      const assets = createLocaleTwinAssets({ manifest });
      const french = await createTransform(assets, frenchRequest());
      const spanish = await createTransform(
        assets,
        request('/', { 'accept-language': 'es' })
      );
      const english = await createTransform(assets, request('/'));
      const ctx = { url: '/assets/index-Ab12.js', kind: 'script' };

      expect(assets.cache).toBe(false);
      expect(french(ctx)).toBe('/assets/index-Ab12.fr-22222222.js');
      expect(spanish(ctx)).toBe('/assets/index-Ab12.es-33333333.js');
      expect(english(ctx)).toBe('/assets/index-Ab12.en-11111111.js');
    });

    it('uses the locale the request already resolved to for rendering', async () => {
      const store = initializeServerGT(gtConfig);
      const assets = createLocaleTwinAssets({ manifest });
      const req = request('/', { cookie: 'generaltranslation.locale=es' });
      vi.mocked(getRequest).mockReturnValue(req);
      expect(store.getLocale()).toBe('es');

      const transform = await createTransform(assets, req);

      expect(transform({ url: '/assets/index-Ab12.js', kind: 'script' })).toBe(
        '/assets/index-Ab12.es-33333333.js'
      );
    });

    it('resolves the path locale with locale routing and writes no cookie', async () => {
      initializeServerGT({ ...gtConfig, localeRouting: true });

      const transform = await createTransform(
        createLocaleTwinAssets({ manifest }),
        request('/es/about', { cookie: 'generaltranslation.locale=fr' })
      );

      expect(transform({ url: '/assets/index-Ab12.js', kind: 'script' })).toBe(
        '/assets/index-Ab12.es-33333333.js'
      );
      expect(setCookie).not.toHaveBeenCalled();
    });

    it('falls back to the default locale twins for a locale the build lacks', async () => {
      initializeServerGT({ defaultLocale: 'en', locales: ['en', 'fr', 'de'] });
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const transform = await createTransform(
        createLocaleTwinAssets({ manifest }),
        request('/', { cookie: 'generaltranslation.locale=de' })
      );

      expect(transform({ url: '/assets/index-Ab12.js', kind: 'script' })).toBe(
        '/assets/index-Ab12.en-11111111.js'
      );
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('"de"'));
      warn.mockRestore();
    });
    it('serves the default locale twins when the visitor disabled i18n', async () => {
      initializeServerGT({ ...gtConfig, enableI18nCookieName: 'my-enable' });

      const transform = await createTransform(
        createLocaleTwinAssets({ manifest }),
        request('/', {
          cookie: 'generaltranslation.locale=fr; my-enable=false',
        })
      );

      expect(transform({ url: '/assets/index-Ab12.js', kind: 'script' })).toBe(
        '/assets/index-Ab12.en-11111111.js'
      );
    });
  });

  describe('without GT initialized on the server', () => {
    it('resolves the cookie, then Accept-Language, against the manifest', async () => {
      const assets = createLocaleTwinAssets({ manifest });
      const ctx = { url: '/assets/index-Ab12.js', kind: 'script' };

      expect((await createTransform(assets, frenchRequest()))(ctx)).toBe(
        '/assets/index-Ab12.fr-22222222.js'
      );
      expect(
        (
          await createTransform(
            assets,
            request('/', { 'accept-language': 'es-MX, fr;q=0.5' })
          )
        )(ctx)
      ).toBe('/assets/index-Ab12.es-33333333.js');
      expect(
        (
          await createTransform(
            createLocaleTwinAssets({ manifest, localeCookieName: 'lang' }),
            request('/', { cookie: 'lang=es' })
          )
        )(ctx)
      ).toBe('/assets/index-Ab12.es-33333333.js');
    });
    it('serves the default locale twins when the visitor disabled i18n', async () => {
      const ctx = { url: '/assets/index-Ab12.js', kind: 'script' };
      expect(
        (
          await createTransform(
            createLocaleTwinAssets({ manifest }),
            request('/', {
              cookie:
                'generaltranslation.locale=fr; generaltranslation.enable-i18n=false',
            })
          )
        )(ctx)
      ).toBe('/assets/index-Ab12.en-11111111.js');
      expect(
        (
          await createTransform(
            createLocaleTwinAssets({ manifest, enableI18nCookieName: 'off' }),
            request('/', { cookie: 'generaltranslation.locale=fr; off=false' })
          )
        )(ctx)
      ).toBe('/assets/index-Ab12.en-11111111.js');
    });
  });

  it('leaves URLs unchanged during warmup', async () => {
    const transform = await createLocaleTwinAssets({
      manifest,
    }).createTransform({ warmup: true });

    expect(transform({ url: '/assets/index-Ab12.js', kind: 'script' })).toBe(
      '/assets/index-Ab12.js'
    );
  });

  it('leaves URLs unchanged without a manifest (dev, or locale twins off)', async () => {
    const transform = await createTransform(
      createLocaleTwinAssets({ manifest: null }),
      frenchRequest()
    );

    expect(transform({ url: '/assets/index-Ab12.js', kind: 'script' })).toBe(
      '/assets/index-Ab12.js'
    );
  });

  it('rejects a manifest with an unknown format version', () => {
    expect(() =>
      createLocaleTwinAssets({
        manifest: { ...manifest, version: 2 } as unknown as LocaleTwinManifest,
      })
    ).toThrow('The locale twin manifest has format version 2');
  });
});
