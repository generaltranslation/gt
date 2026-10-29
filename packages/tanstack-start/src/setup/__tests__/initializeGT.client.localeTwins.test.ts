/**
 * The browser initializes GT from the Vite plugin's config module, which also
 * carries the server's translation loader. With locale twins the client must
 * not load translations (they come from the registered twins) and a locale
 * switch must load a new document.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { pluginModule, localeRouting } = vi.hoisted(() => ({
  pluginModule: {
    config: undefined as Record<string, unknown> | undefined,
    loadTranslations: undefined as (() => Promise<object>) | undefined,
    dictionary: undefined,
    loadDictionary: undefined,
  },
  localeRouting: { enabled: false },
}));

vi.mock('gt-tanstack-start/internal/_config', () => pluginModule);

// The plugin resolves this module to the enabled or disabled variant.
vi.mock('gt-tanstack-start/internal/localeRouting', async () =>
  localeRouting.enabled
    ? import('../../internal/localeRouting.enabled')
    : import('../../internal/localeRouting.disabled')
);

// The client entry imports gt-react's browser build; Node resolves the server one.
vi.mock('gt-react', async () => {
  const { createRequire } = await import('node:module');
  const { pathToFileURL } = await import('node:url');
  const require = createRequire(import.meta.url);
  const serverEntry = require.resolve('gt-react');
  return import(
    pathToFileURL(
      serverEntry.replace(/index\.server\.c?js$/, 'index.client.mjs')
    ).href
  );
});

type TestGlobal = typeof globalThis & { __generaltranslation?: unknown };

const TWINS_CONFIG = {
  defaultLocale: 'en',
  locales: ['en', 'fr'],
  files: {
    gt: {
      output: 'src/_gt/[locale].json',
      splitting: 'locale-twins' as const,
    },
  },
};

/** A `document` whose `cookie` behaves like a browser cookie jar. */
function createCookieDocument() {
  const jar = new Map<string, string>();
  return {
    get cookie() {
      return [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
    },
    set cookie(header: string) {
      const [pair] = header.split(';');
      const index = pair.indexOf('=');
      jar.set(pair.slice(0, index).trim(), pair.slice(index + 1));
    },
  };
}

function stubBrowser(pathname = '/en/about') {
  const location = {
    href: `https://example.com${pathname}`,
    pathname,
    assign: vi.fn(),
    reload: vi.fn(),
  };
  vi.stubGlobal('window', { location });
  vi.stubGlobal('document', createCookieDocument());
  return location;
}

/** Fresh modules, initialized from the given plugin config. */
async function initializeWith(
  config: Record<string, unknown>,
  { loadTranslations = undefined as (() => Promise<object>) | undefined } = {}
) {
  pluginModule.config = config;
  pluginModule.loadTranslations = loadTranslations;
  localeRouting.enabled = config.localeRouting === true;
  vi.resetModules();
  const { ensureInitialized } = await import('../initializeGT.client');
  ensureInitialized();
  return {
    gtReact: await import('gt-react'),
    reactCore: await import('@generaltranslation/react-core/pure'),
  };
}

describe.sequential('client initialization with locale twins', () => {
  beforeEach(() => {
    Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(globalThis as TestGlobal, '__generaltranslation');
  });

  it('does not load translations on the client', async () => {
    stubBrowser();
    const loadTranslations = vi.fn(async () => ({}));

    const { gtReact } = await initializeWith(
      { ...TWINS_CONFIG, projectId: 'project' },
      { loadTranslations }
    );

    await expect(gtReact.getTranslationsSnapshot('fr')).resolves.toEqual({});
    expect(loadTranslations).not.toHaveBeenCalled();
  });

  it('keeps the locale routing navigation as the only reload', async () => {
    const location = stubBrowser('/en/about');
    const { reactCore } = await initializeWith({
      ...TWINS_CONFIG,
      localeRouting: true,
    });

    reactCore.getReadonlyConditionStore().setLocale('fr');

    expect(location.assign).toHaveBeenCalledWith(
      'https://example.com/fr/about'
    );
    expect(location.reload).not.toHaveBeenCalled();
  });
});
