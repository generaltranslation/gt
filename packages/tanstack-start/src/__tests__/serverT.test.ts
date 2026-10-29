import { beforeEach, describe, expect, it, vi } from 'vitest';

const HASH = '0123456789abcdef';

const { pluginModule, currentRequest } = vi.hoisted(() => ({
  pluginModule: {
    config: undefined as Record<string, unknown> | undefined,
    loadTranslations: async (locale: string) =>
      locale === 'fr' ? { '0123456789abcdef': 'Bonjour' } : {},
    dictionary: undefined,
    loadDictionary: undefined,
  },
  currentRequest: { value: undefined as Request | undefined },
}));

vi.mock('gt-tanstack-start/internal/_config', () => pluginModule);

vi.mock('@tanstack/react-start/server', () => ({
  getRequest: () => {
    if (!currentRequest.value) throw new Error('No StartEvent');
    return currentRequest.value;
  },
  setCookie: vi.fn(),
  getResponseHeader: vi.fn(),
  setResponseHeader: vi.fn(),
}));

type ServerEntry = typeof import('../index.server');

/** Fresh modules, initialized from the plugin config. */
async function initialize(
  splitting: 'locale' | 'locale-twins'
): Promise<ServerEntry> {
  Reflect.deleteProperty(globalThis, '__generaltranslation');
  pluginModule.config = {
    defaultLocale: 'en',
    locales: ['en', 'fr'],
    files: { gt: { output: 'src/_gt/[locale].json', splitting } },
  };
  vi.resetModules();
  const entry = await import('../index.server');
  const { ensureInitialized } = await import('../setup/initializeGT.server');
  ensureInitialized();
  return entry;
}

/** Loads the request locale, then calls `render` in that request. */
async function renderFor(
  { getLocale, getGT }: ServerEntry,
  locale: string,
  render: () => string
) {
  currentRequest.value = new Request('https://example.com/', {
    headers: { cookie: `generaltranslation.locale=${locale}` },
  });
  try {
    // Loads the request locale, as the router integration does before render.
    await getGT();
    expect(getLocale()).toBe(locale);
    return render();
  } finally {
    currentRequest.value = undefined;
  }
}

// t() reads the locale outside React; on the server that is the request's.
describe.sequential('t() during server rendering', () => {
  beforeEach(() => {
    Reflect.deleteProperty(globalThis, '__generaltranslation');
  });

  it('renders the source text in the default locale', async () => {
    const entry = await initialize('locale');

    await expect(
      renderFor(entry, 'en', () => entry.t('Hello', { $_hash: HASH }))
    ).resolves.toBe('Hello');
  });

  it('translates into the request locale with locale twins', async () => {
    const entry = await initialize('locale-twins');

    await expect(
      renderFor(entry, 'fr', () => entry.t('Hello', { $_hash: HASH }))
    ).resolves.toBe('Bonjour');
  });
});
