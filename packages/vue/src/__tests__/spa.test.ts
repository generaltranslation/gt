import { hashStringMessage } from 'gt-i18n/internal/string';
import { createSSRApp, defineComponent, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGT, initializeGTSPA, t, useGT, useSetLocale } from '../index';
import { resetGTSPAForTests } from '../runtime/spa';
import type { TranslationCatalog } from '../types';

describe('gt-vue SPA runtime', () => {
  afterEach(() => {
    resetGTSPAForTests();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('preloads the cookie locale and shares one runtime with t and app.use', async () => {
    const browser = installBrowser('generaltranslation.locale=fr');
    const source = 'Documentation';
    const context = 'primary navigation';
    const hash = hashStringMessage(source, { $context: context });
    const loadTranslations = vi.fn(async () => ({
      [hash]: 'Documentation FR',
    }));

    const plugin = await initializeGTSPA({
      defaultLocale: 'en',
      loadTranslations,
    });

    expect(plugin.getLocale()).toBe('fr');
    expect(t(source, { $context: context })).toBe('Documentation FR');

    const Root = defineComponent({
      setup() {
        const gt = useGT();
        return () => h('p', gt(source, { $context: context }));
      },
    });
    const html = await renderToString(createSSRApp(Root).use(plugin));

    expect(html).toContain('Documentation FR');
    expect(loadTranslations).toHaveBeenCalledOnce();
    expect(loadTranslations).toHaveBeenCalledWith('fr');
    expect(browser.cookies.get('generaltranslation.locale')).toBe('fr');
  });

  it('uses an explicit locale before a stale cookie and persists it', async () => {
    const browser = installBrowser('generaltranslation.locale=fr');
    const loadTranslations = vi.fn(async () => ({}));

    const plugin = await initializeGTSPA({
      defaultLocale: 'en',
      loadTranslations,
      locale: 'de',
    });

    expect(plugin.getLocale()).toBe('de');
    expect(loadTranslations).toHaveBeenCalledWith('de');
    expect(browser.cookies.get('generaltranslation.locale')).toBe('de');
  });

  it('normalizes configured locales case-insensitively', async () => {
    const browser = installBrowser('generaltranslation.locale=FR-ca');
    const loadTranslations = vi.fn(async () => ({}));

    const plugin = await initializeGTSPA({
      defaultLocale: 'en',
      locales: ['fr-CA'],
      loadTranslations,
    });

    expect(plugin.getLocale()).toBe('fr-CA');
    expect(loadTranslations).toHaveBeenCalledWith('fr-CA');
    expect(browser.cookies.get('generaltranslation.locale')).toBe('fr-CA');
  });

  it('preserves configured locale spelling for catalog file loading', async () => {
    const browser = installBrowser('generaltranslation.locale=fr');
    const loadTranslations = vi.fn(async () => ({}));

    const plugin = await initializeGTSPA({
      defaultLocale: 'EN-us',
      locales: ['FR-fr'],
      loadTranslations,
    });

    expect(plugin.getLocale()).toBe('FR-fr');
    expect(loadTranslations).toHaveBeenCalledWith('FR-fr');
    expect(browser.cookies.get('generaltranslation.locale')).toBe('FR-fr');
  });

  it('keeps a noncanonical default locale on the source catalog', async () => {
    const browser = installBrowser();
    const loadTranslations = vi.fn(async () => ({}));

    const plugin = await initializeGTSPA({
      defaultLocale: 'EN-us',
      locales: ['FR-ca'],
      loadTranslations,
    });

    expect(plugin.getLocale()).toBe('EN-us');
    expect(loadTranslations).not.toHaveBeenCalled();
    expect(browser.cookies.get('generaltranslation.locale')).toBe('EN-us');
  });

  it('maps canonical locale cookies back to configured custom aliases', async () => {
    const browser = installBrowser('generaltranslation.locale=fr');
    const loadTranslations = vi.fn(async () => ({}));

    const plugin = await initializeGTSPA({
      defaultLocale: 'en',
      locales: ['pirate'],
      customMapping: { pirate: { code: 'fr' } },
      loadTranslations,
    });

    expect(plugin.getLocale()).toBe('pirate');
    expect(loadTranslations).toHaveBeenCalledWith('pirate');
    expect(browser.cookies.get('generaltranslation.locale')).toBe('pirate');
  });

  it.each([
    {
      cookieLocale: 'fr-CA',
      configuredLocale: 'fr',
      resolvedLocale: 'fr',
    },
    {
      cookieLocale: 'fr',
      configuredLocale: 'fr-FR',
      resolvedLocale: 'fr-FR',
    },
  ])(
    'resolves $cookieLocale to configured locale $configuredLocale',
    async ({ cookieLocale, configuredLocale, resolvedLocale }) => {
      const browser = installBrowser(
        `generaltranslation.locale=${cookieLocale}`
      );
      const loadTranslations = vi.fn(async () => ({}));

      const plugin = await initializeGTSPA({
        defaultLocale: 'en',
        locales: [configuredLocale],
        loadTranslations,
      });

      expect(plugin.getLocale()).toBe(resolvedLocale);
      expect(loadTranslations).toHaveBeenCalledWith(resolvedLocale);
      expect(browser.cookies.get('generaltranslation.locale')).toBe(
        resolvedLocale
      );
    }
  );

  it('replaces an unsupported cookie locale with the configured default', async () => {
    const browser = installBrowser('generaltranslation.locale=es');
    const loadTranslations = vi.fn(async () => ({}));

    const plugin = await initializeGTSPA({
      defaultLocale: 'en',
      locales: ['fr'],
      loadTranslations,
    });

    expect(plugin.getLocale()).toBe('en');
    expect(browser.cookies.get('generaltranslation.locale')).toBe('en');
    expect(loadTranslations).not.toHaveBeenCalled();
  });

  it('falls back before persisting an unsupported locale change', async () => {
    const browser = installBrowser('generaltranslation.locale=fr');
    const plugin = await initializeGTSPA({
      defaultLocale: 'en',
      locales: ['fr'],
      loadTranslations: async () => ({}),
    });

    await plugin.setLocale('es');

    expect(plugin.getLocale()).toBe('en');
    expect(browser.cookies.get('generaltranslation.locale')).toBe('en');
    expect(browser.reload).toHaveBeenCalledOnce();
  });

  it('uses source strings without loading the default locale', async () => {
    installBrowser();
    const loadTranslations = vi.fn(async () => ({ ignored: 'Ignored' }));

    const plugin = await initializeGTSPA({
      defaultLocale: 'en',
      loadTranslations,
    });

    expect(plugin.getLocale()).toBe('en');
    expect(t('Source text')).toBe('Source text');
    expect(loadTranslations).not.toHaveBeenCalled();
  });

  it('falls back when a STRING hash points to rich content', async () => {
    installBrowser('generaltranslation.locale=fr');
    const source = 'Plain content';
    const catalog: TranslationCatalog = {
      [hashStringMessage(source)]: { t: 'strong', i: 1, c: 'Rich content' },
    };
    await initializeGTSPA({ loadTranslations: async () => catalog });

    expect(t(source)).toBe(source);
  });

  it('reports t calls made before initialization completes', async () => {
    installBrowser();

    expect(() => t('Too early')).toThrow(
      't() ran before the GT Vue SPA runtime finished initializing'
    );

    let resolveCatalog!: (catalog: TranslationCatalog) => void;
    const initialization = initializeGTSPA({
      locale: 'fr',
      loadTranslations: () =>
        new Promise((resolve) => {
          resolveCatalog = resolve;
        }),
    });
    await vi.waitFor(() => expect(resolveCatalog).toBeTypeOf('function'));

    expect(() => t('Still too early')).toThrow(
      't() ran before the GT Vue SPA runtime finished initializing'
    );

    resolveCatalog({});
    await initialization;
  });

  it('rejects SPA initialization and t in server environments', async () => {
    await expect(initializeGTSPA()).rejects.toThrow(
      'initializeGTSPA() cannot run in a server-rendered environment'
    );
    expect(() => t('Server message')).toThrow(
      't() cannot run in a server-rendered environment'
    );
  });

  it('shares concurrent initialization and returns the same plugin later', async () => {
    installBrowser('generaltranslation.locale=fr');
    let resolveCatalog!: (catalog: TranslationCatalog) => void;
    const loadTranslations = vi.fn(
      () =>
        new Promise<TranslationCatalog>((resolve) => {
          resolveCatalog = resolve;
        })
    );

    const first = initializeGTSPA({ loadTranslations });
    const second = initializeGTSPA({ loadTranslations });
    await vi.waitFor(() => expect(loadTranslations).toHaveBeenCalledOnce());

    resolveCatalog({});
    const [firstPlugin, secondPlugin] = await Promise.all([first, second]);
    const laterPlugin = await initializeGTSPA({
      loadTranslations: vi.fn(async () => ({})),
    });

    expect(secondPlugin).toBe(firstPlugin);
    expect(laterPlugin).toBe(firstPlugin);
    expect(loadTranslations).toHaveBeenCalledOnce();
  });

  it('clears failed initialization so a later call can retry', async () => {
    installBrowser('generaltranslation.locale=fr');
    const error = new Error('catalog failed');
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    await expect(
      initializeGTSPA({ loadTranslations: async () => Promise.reject(error) })
    ).rejects.toBe(error);
    expect(() => t('Unavailable')).toThrow(
      't() ran before the GT Vue SPA runtime finished initializing'
    );

    const plugin = await initializeGTSPA({
      loadTranslations: async () => ({}),
    });

    expect(plugin.getLocale()).toBe('fr');
    expect(consoleError).toHaveBeenCalledOnce();
  });

  it('writes a new locale and reloads without preloading its catalog', async () => {
    const browser = installBrowser();
    const source = 'Welcome';
    const frenchHash = hashStringMessage(source);
    const loadTranslations = vi.fn(async () => ({
      [frenchHash]: 'Bienvenue',
    }));
    const plugin = await initializeGTSPA({
      defaultLocale: 'en',
      loadTranslations,
    });
    let setLocale!: (locale: string) => Promise<void>;
    const Root = defineComponent({
      setup() {
        setLocale = useSetLocale();
        return () => h('p', t(source));
      },
    });
    await renderToString(createSSRApp(Root).use(plugin));

    await setLocale('fr');

    expect(browser.cookies.get('generaltranslation.locale')).toBe('fr');
    expect(browser.reload).toHaveBeenCalledOnce();
    expect(loadTranslations).not.toHaveBeenCalled();
    expect(plugin.getLocale()).toBe('fr');
    expect(t(source)).toBe(source);
  });

  it('supports a custom locale cookie for initial and changed locales', async () => {
    const browser = installBrowser(
      'generaltranslation.locale=fr; custom-locale=es'
    );
    const plugin = await initializeGTSPA({
      localeCookieName: 'custom-locale',
      loadTranslations: async () => ({}),
    });

    expect(plugin.getLocale()).toBe('es');
    await plugin.setLocale('de');

    expect(browser.cookies.get('custom-locale')).toBe('de');
    expect(browser.cookies.get('generaltranslation.locale')).toBe('fr');
    expect(browser.reload).toHaveBeenCalledOnce();
  });

  it('leaves ordinary createGT locale changes reactive and reload-free', async () => {
    const browser = installBrowser();
    const loadTranslations = vi.fn(async () => ({}));
    const plugin = createGT({ loadTranslations });

    await plugin.setLocale('fr');

    expect(plugin.getLocale()).toBe('fr');
    expect(loadTranslations).toHaveBeenCalledWith('fr');
    expect(browser.reload).not.toHaveBeenCalled();
  });
});

class TestCookieDocument {
  readonly writes: string[] = [];
  private readonly values = new Map<string, string>();

  constructor(cookieHeader = '') {
    for (const cookie of cookieHeader.split(';')) {
      const separator = cookie.indexOf('=');
      if (separator < 0) continue;
      this.values.set(
        cookie.slice(0, separator).trim(),
        cookie.slice(separator + 1).trim()
      );
    }
  }

  get cookie(): string {
    return [...this.values]
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  set cookie(serializedCookie: string) {
    this.writes.push(serializedCookie);
    const [cookie = ''] = serializedCookie.split(';');
    const separator = cookie.indexOf('=');
    if (separator < 0) return;
    this.values.set(
      cookie.slice(0, separator).trim(),
      cookie.slice(separator + 1).trim()
    );
  }

  get(cookieName: string): string | undefined {
    return this.values.get(cookieName);
  }
}

function installBrowser(cookieHeader = ''): {
  cookies: TestCookieDocument;
  reload: ReturnType<typeof vi.fn>;
} {
  const cookies = new TestCookieDocument(cookieHeader);
  const reload = vi.fn();
  vi.stubGlobal('document', cookies);
  vi.stubGlobal('window', { location: { reload } });
  return { cookies, reload };
}
