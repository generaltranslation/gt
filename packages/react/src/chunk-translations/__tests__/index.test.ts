// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  initializeChunkTranslations,
  initializeMappedChunkTranslations,
  initializeRegionChunkTranslations,
  loadChunk,
  loadChunkTranslations,
  loadMappedChunk,
  loadMappedChunkTranslations,
  loadRegionChunk,
  loadRegionChunkTranslations,
  type ChunkTranslationsState,
} from '../chunk-translations';
import { resolveChunkUrl } from '../chunk-translations/gate';
import { getReactI18nCache, t } from '@generaltranslation/react-core/pure';
import { initializeGTSPA } from '../setup/initializeGTSPA';

// What the compiler writes is tested where it is written:
// packages/compiler/src/__tests__/chunkTranslations.test.ts.

const SAVE = '002c822e1ceb12f7';
const ORDERS = '184c9605dde81513';
const CONFIG = { defaultLocale: 'en', locales: ['fr', 'de'] };

/** The files a server holds, by URL; a function is a response made by hand. */
type Files = Record<string, unknown | (() => Promise<Response>)>;

// Which files each dynamic import needs, as the entry's file holds it: the
// import of the Orders chunk needs the file of its own key
const IMPORTED = { k: ['assets/Orders-b2'], c: [[1]] };

const FILES: Files = {
  '/assets/index-a1.fr.11111111.json': {
    t: { [SAVE]: 'Enregistrer' },
    i: IMPORTED,
  },
  // Named with the token of the locale, where the entry's has its own hash
  '/assets/Orders-b2.fr.22222222.json': { [ORDERS]: 'Commandes' },
};

function serve(files: Files = FILES) {
  const fetched = vi.fn((url: string, _options?: RequestInit) => {
    // What names a build's current files is asked for past every cache
    const file = files[url.split('?')[0]];
    if (typeof file === 'function') return file() as Promise<Response>;
    return Promise.resolve(
      file === undefined
        ? new Response('Not found', { status: 404 })
        : new Response(JSON.stringify(file))
    );
  });
  vi.stubGlobal('fetch', fetched);
  return fetched;
}

/** What the page's startup script leaves, without the request it starts. */
function writeState(state: Partial<ChunkTranslationsState> = {}) {
  Object.assign(globalThis, {
    __GT_CHUNK_TRANSLATIONS__: {
      b: '/',
      f: 'assets/index-a1',
      h: { fr: '11111111' },
      v: { fr: '22222222' },
      ...state,
    },
  });
}

function setLocale(locale: string) {
  document.cookie = `generaltranslation.locale=${locale}`;
}

const start = (config: object = CONFIG) =>
  initializeChunkTranslations(initializeGTSPA, config);

// As the compiler writes them: the hash is looked up in the translations cache
const save = () => t({ $_hash: SAVE } as never)`Save`;
const orders = () => t({ $_hash: ORDERS } as never)`Orders`;

const ORDERS_FILE = '/assets/Orders-b2.fr.22222222.json';
const ORDERS_CHUNK = 'assets/Orders-b2.js';

/** The links of the page, as their `rel` and the path they name. */
const links = () =>
  [...document.querySelectorAll('link')].map(
    (link) => `${link.rel} ${new URL(link.href).pathname}`
  );

/**
 * A browser's `import.meta.resolve` in a page with the import map `imports`,
 * for a key that is a path from the root or a specifier as it is written.
 * Without `imports`, that of a browser that has none.
 */
const resolveWith =
  (imports: Record<string, string> | undefined) => (specifier: string) => {
    if (!imports) throw new TypeError('import.meta.resolve is not a function');
    const url = (path: string) => new URL(path, document.baseURI).href;
    const isUrl = URL.canParse(specifier) || specifier.startsWith('/');
    const file = Object.entries(imports).find(([key]) =>
      key.startsWith('/')
        ? isUrl && url(key) === url(specifier)
        : key === specifier
    )?.[1];
    if (file === undefined && !isUrl) {
      throw new TypeError(`Failed to resolve module specifier "${specifier}"`);
    }
    return url(file ?? specifier);
  };

/** A response to send by hand, as a file that takes its time. */
function hold(file: unknown) {
  let respond!: () => void;
  const response = new Promise<Response>((resolve) => {
    respond = () => resolve(new Response(JSON.stringify(file)));
  });
  return { response: () => response, respond };
}

const tick = () => new Promise((resolve) => setTimeout(resolve));

type Load = typeof loadChunk;

// A module that reads a translation as it is evaluated
const evaluate = (steps: string[]) => () => {
  steps.push('import');
  return Promise.resolve({ evaluated: orders() });
};

/**
 * A dynamic import as compiled code writes it. For one Vite preloads, that
 * is Vite's preload call, which adds its links and then calls `import()`,
 * with the chunks it lists, the imported one first.
 */
const preloadedImport =
  (steps: string[]) =>
  (load: Load = loadChunk) =>
    load(
      evaluate(steps),
      0,
      (start, deps) => {
        steps.push(`preload ${deps}`);
        return start();
      },
      [ORDERS_CHUNK, 'assets/shared-c3.js']
    );
const PRELOAD = `preload ${ORDERS_CHUNK},assets/shared-c3.js`;

/** One no bundler preloads names its chunk. */
const plainImport =
  (steps: string[]) =>
  (load: Load = loadChunk) =>
    load(evaluate(steps), ORDERS_CHUNK);

describe('gt-react/chunk-translations', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setLocale('fr');
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    // gt-react keeps the locale and whether i18n is on in cookies
    for (const cookie of document.cookie.split(';')) {
      document.cookie = `${cookie.split('=')[0].trim()}=;path=/;max-age=0`;
    }
    Reflect.deleteProperty(globalThis, '__GT_CHUNK_TRANSLATIONS__');
    Reflect.deleteProperty(globalThis, '__generaltranslation');
    document.head.replaceChildren();
  });

  it('starts with the entry file and without the catalog', async () => {
    const fetched = serve();
    writeState();
    const loadTranslations = vi.fn(async () => ({ [SAVE]: 'Catalogue' }));

    await start({ ...CONFIG, loadTranslations });

    expect(loadTranslations).not.toHaveBeenCalled();
    expect(fetched.mock.calls).toEqual([['/assets/index-a1.fr.11111111.json']]);
    expect(save()).toBe('Enregistrer');
    // Its file has not been loaded
    expect(orders()).toBe('Orders');
    expect(
      getReactI18nCache().lookupTranslation('fr', 'Save', {
        $format: 'STRING',
        $_hash: SAVE,
      } as never)
    ).toBe('Enregistrer');
    expect(warn).not.toHaveBeenCalled();
  });

  it('reads the request the startup script made instead of making another', async () => {
    const fetched = serve();
    writeState({
      l: 'fr',
      p: {
        fr: Promise.resolve({ t: { [SAVE]: 'Du script' }, i: IMPORTED }),
      },
      // The file of a chunk the page preloads
      g: { 'fr assets/Orders-b2': Promise.resolve({ [ORDERS]: 'Du lien' }) },
    });

    await start();
    await plainImport([])();

    expect(fetched).not.toHaveBeenCalled();
    expect(save()).toBe('Du script');
    expect(orders()).toBe('Du lien');
  });

  it.each([
    // Vite adds the link for the chunk; gt-react does when no bundler does
    ['an import Vite preloads', preloadedImport, [PRELOAD], []],
    [
      'an import no bundler preloads',
      plainImport,
      [],
      ['modulepreload /assets/Orders-b2.js'],
    ],
  ])(
    'requests the files of %s while its chunk downloads, and runs the import once they arrived',
    async (_name, createImport, started, preloaded) => {
      const file = hold(FILES[ORDERS_FILE]);
      const fetched = serve({ ...FILES, [ORDERS_FILE]: file.response });
      writeState();
      await start();
      fetched.mockClear();
      const steps: string[] = [];

      const loading = createImport(steps)();

      // In the tick of the call: the file and the chunk wait for nothing
      expect(fetched.mock.calls).toEqual([[ORDERS_FILE]]);
      expect(links()).toEqual(preloaded);
      expect(steps).toEqual(started);
      await tick();
      expect(steps).toEqual(started);

      file.respond();
      expect(await loading).toEqual({ evaluated: 'Commandes' });
      expect(steps).toEqual([...started, 'import']);
    }
  );

  it("waits for the entry's file, which says which files an import needs, when the import starts before it has arrived", async () => {
    const entry = hold(FILES['/assets/index-a1.fr.11111111.json']);
    const fetched = serve({
      ...FILES,
      '/assets/index-a1.fr.11111111.json': entry.response,
    });
    writeState();
    const starting = start();
    const steps: string[] = [];

    const loading = preloadedImport(steps)();
    await tick();
    expect(steps).toEqual([PRELOAD]);
    expect(fetched).toHaveBeenCalledTimes(1);

    entry.respond();
    expect(await loading).toEqual({ evaluated: 'Commandes' });
    await starting;
    expect(fetched.mock.calls.flat()).toEqual([
      '/assets/index-a1.fr.11111111.json',
      ORDERS_FILE,
    ]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('keeps the files that arrive while gt-react loads the locale, which would replace them', async () => {
    serve();
    writeState();
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    // A slow load of the locale, as the unsplit file's loader makes it
    const starting = initializeChunkTranslations(
      (config: { loadTranslations: (locale: string) => Promise<object> }) =>
        initializeGTSPA({
          ...config,
          loadTranslations: (locale: string) =>
            held.then(() => config.loadTranslations(locale)),
        } as never),
      CONFIG
    );
    const steps: string[] = [];
    // Its files arrive before the load has resolved
    await plainImport(steps)();
    await tick();
    release();
    await starting;

    expect(save()).toBe('Enregistrer');
    expect(orders()).toBe('Commandes');
    expect(warn).not.toHaveBeenCalled();
  });

  it('adds the files of an import to the cache once the locale has loaded', async () => {
    serve();
    writeState();
    await start();
    expect(orders()).toBe('Orders');
    const steps: string[] = [];
    expect(await plainImport(steps)()).toEqual({ evaluated: 'Commandes' });
    expect(orders()).toBe('Commandes');
    expect(save()).toBe('Enregistrer');
  });

  it('requests each file and preloads each chunk once, however often it is imported', async () => {
    const file = hold(FILES[ORDERS_FILE]);
    const fetched = serve({ ...FILES, [ORDERS_FILE]: file.response });
    writeState();
    await start();
    fetched.mockClear();
    const steps: string[] = [];
    const load = plainImport(steps);

    const together = Promise.all([load(), load()]);
    file.respond();
    expect(await together).toEqual([
      { evaluated: 'Commandes' },
      { evaluated: 'Commandes' },
    ]);
    await load();

    expect(fetched).toHaveBeenCalledTimes(1);
    expect(links()).toEqual(['modulepreload /assets/Orders-b2.js']);
  });

  it('adds no link for a chunk the page preloads already', async () => {
    serve();
    writeState();
    await start();
    document.head.innerHTML =
      '<link rel="modulepreload" href="/assets/Orders-b2.js">';

    expect(await plainImport([])()).toEqual({ evaluated: 'Commandes' });

    expect(links()).toEqual(['modulepreload /assets/Orders-b2.js']);
  });

  it.each([
    [
      'its path from the base in a build without an import map',
      {},
      ORDERS_CHUNK,
      'http://localhost:3000/assets/Orders-b2.js',
    ],
    [
      'the file an import map has for its path from the base',
      { '/assets/Orders-n1.js': '/assets/Orders-b2.js' },
      'assets/Orders-n1.js',
      'http://localhost:3000/assets/Orders-b2.js',
    ],
    [
      'the file an import map has for a name that is not a path',
      { 'r:Orders-n1.js': '/assets/Orders-b2.js' },
      'r:Orders-n1.js',
      'http://localhost:3000/assets/Orders-b2.js',
    ],
    [
      'its path from the base where the browser resolves no specifier',
      undefined,
      ORDERS_CHUNK,
      '/assets/Orders-b2.js',
    ],
  ])('preloads a chunk from %s', (_name, imports, chunk, url) => {
    expect(resolveChunkUrl(`/${chunk}`, chunk, resolveWith(imports))).toBe(url);
  });

  it.each([
    ['the default locale', 'en', true],
    ['i18n turned off', 'fr', false],
  ])('requests nothing for %s', async (_name, locale, enableI18n) => {
    const fetched = serve();
    writeState();
    setLocale(locale);
    await start({ ...CONFIG, enableI18n });

    const loaded = Promise.resolve({ loaded: true });
    expect(loadChunk(() => loaded, ORDERS_CHUNK)).toBe(loaded);
    // The call the bundler wrote, in the tick of this one, and no link
    const steps: string[] = [];
    void preloadedImport(steps)();
    void plainImport(steps)();
    expect(steps).toEqual([PRELOAD, 'import', 'import']);
    expect(links()).toEqual([]);
    expect(loadChunkTranslations(['assets/Orders-b2'])).toBeUndefined();
    expect(fetched).not.toHaveBeenCalled();
    expect(save()).toBe('Save');
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns once when the lists do not know a chunk the build named, and runs the import', async () => {
    const fetched = serve();
    writeState();
    await start();
    fetched.mockClear();
    const load = () => loadChunk(evaluate([]), 'assets/Settings-e5.js');

    expect(await load()).toEqual({ evaluated: 'Orders' });
    await load();

    expect(fetched).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain(
      'The build lists no translation files for assets/Settings-e5.js. Its messages render the source text. Report this defect of the build to General Translation.'
    );
  });

  it.each([
    ['as the build writes its files', 'assets/table-d4.js'],
    ['relative to the chunk that imports it', './table-d4.js'],
  ])(
    'says nothing of a chunk that needs no file, which the bundler names %s',
    async (_name, chunk) => {
      const fetched = serve();
      writeState();
      await start();
      fetched.mockClear();
      const steps: string[] = [];

      // The build names no chunk, so the first one the bundler lists is read
      await loadChunk(
        evaluate(steps),
        0,
        (run, deps) => {
          steps.push(`preload ${deps}`);
          return run();
        },
        [chunk, 'assets/shared-c3.js']
      );

      expect(steps).toEqual([`preload ${chunk},assets/shared-c3.js`, 'import']);
      expect(fetched).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
    }
  );

  it('renders the source and warns when a file is missing, and asks for it again later', async () => {
    const files = { ...FILES };
    delete files['/assets/Orders-b2.fr.22222222.json'];
    const fetched = serve(files);
    writeState();
    await start();

    // The import still runs, with the source
    expect(await preloadedImport([])()).toEqual({ evaluated: 'Orders' });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain(
      'Could not load the translations in /assets/Orders-b2.fr.22222222.json'
    );

    Object.assign(files, FILES);
    await plainImport([])();
    expect(orders()).toBe('Commandes');
    expect(fetched).toHaveBeenCalledTimes(3);
  });

  it('stops waiting for a file after the timeout, once, and still reads it when it arrives', async () => {
    let respond!: (response: Response) => void;
    serve({
      '/assets/index-a1.fr.11111111.json': () =>
        new Promise<Response>((resolve) => (respond = resolve)),
    });
    writeState({ w: 2000 });
    vi.useFakeTimers();

    let started = false;
    const starting = start().then(() => (started = true));
    await vi.advanceTimersByTimeAsync(1999);
    expect(started).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await starting;
    expect(warn.mock.calls[0][0]).toContain('did not load within 2000 ms');
    expect(save()).toBe('Save');

    // The late file is not waited for a second time
    let restarted = false;
    void start().then(() => (restarted = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(restarted).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);

    respond(new Response(JSON.stringify({ t: { [SAVE]: 'Enregistrer' } })));
    await vi.advanceTimersByTimeAsync(0);
    expect(save()).toBe('Enregistrer');
  });

  it('runs an import with the source once the timeout of its file has passed, and the next one without waiting', async () => {
    const file = hold(FILES[ORDERS_FILE]);
    serve({ ...FILES, [ORDERS_FILE]: file.response });
    writeState({ w: 2000 });
    await start();
    vi.useFakeTimers();
    const steps: string[] = [];

    const loading = preloadedImport(steps)();
    await vi.advanceTimersByTimeAsync(1999);
    expect(steps).toEqual([PRELOAD]);
    await vi.advanceTimersByTimeAsync(1);
    expect(await loading).toEqual({ evaluated: 'Orders' });
    expect(warn.mock.calls[0][0]).toContain('did not load within 2000 ms');

    const again = plainImport([])();
    await vi.advanceTimersByTimeAsync(0);
    expect(await again).toEqual({ evaluated: 'Orders' });
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      'a page without the startup script',
      undefined,
      'did not run its startup script',
    ],
    [
      'a locale the build has no file for',
      { h: {}, v: {} },
      'no translations for "fr"',
    ],
  ])('warns once on %s', async (_name, state, warning) => {
    const fetched = serve();
    if (state) writeState(state);

    await start();
    expect(await plainImport([])()).toEqual({ evaluated: 'Orders' });

    expect(fetched).not.toHaveBeenCalled();
    expect(save()).toBe('Save');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain(warning);
  });

  describe('in a build with hash minification', () => {
    // A call site passes the name of the list of its chunk's messages, a
    // dot, and the place of its message in that list. A file holds each of
    // its translations once, and for each list the runs that read them: a
    // place in the list, the place of the translation, and how many follow
    const GREETING = ['Bonjour, ', ['name'], ' !'];
    const MINIFIED: Files = {
      '/assets/index-a1.fr.11111111.json': {
        t: [
          ['Enregistrer', GREETING],
          { Xk3_9aQz: [0, 0, 2], b0Ye4_Hs: [4, 1, 1] },
        ],
        i: IMPORTED,
      },
      // Two runs of one list, the second after a place the file does not
      // hold, and a message that two chunks read
      [ORDERS_FILE]: [
        ['Commandes', GREETING, 'Annuler'],
        { p7Lm2QdE: [0, 0, 1, 2, 1, 2], b0Ye4_Hs: [7, 1, 1] },
      ],
    };
    /** What the translations cache holds for an id, as it holds it. */
    const held = (id: string) =>
      getReactI18nCache().lookupTranslation(
        'fr',
        'Source' as never,
        {
          $_hash: id,
        } as never
      );

    it('reads a file into an entry for each id, and nothing for a place no run holds', async () => {
      serve(MINIFIED);
      writeState();
      await start();

      expect(t({ $_hash: 'Xk3_9aQz.0' } as never)`Save`).toBe('Enregistrer');
      expect(held('Xk3_9aQz.1')).toEqual(GREETING);
      expect(held('b0Ye4_Hs.4')).toEqual(GREETING);
      // A place after a run, a list of another file, and a list of no file
      expect(t({ $_hash: 'Xk3_9aQz.2' } as never)`Cancel`).toBe('Cancel');
      expect(held('b0Ye4_Hs.7')).toBeUndefined();
      expect(held('p7Lm2QdE.0')).toBeUndefined();
      expect(held('Zz9_none.0')).toBeUndefined();

      await loadChunk(() => Promise.resolve(), ORDERS_CHUNK);
      expect(
        ['p7Lm2QdE.0', 'p7Lm2QdE.1', 'p7Lm2QdE.2', 'p7Lm2QdE.3'].map(held)
      ).toEqual(['Commandes', undefined, GREETING, 'Annuler']);
      expect(held('b0Ye4_Hs.7')).toEqual(GREETING);
      expect(warn).not.toHaveBeenCalled();
    });

    it('gives every id of a translation the one value its file holds', async () => {
      serve(MINIFIED);
      writeState();
      await start();
      // What had arrived when the locale was loaded
      expect(held('Xk3_9aQz.1')).toBe(held('b0Ye4_Hs.4'));
      // And what arrives later
      await loadChunk(() => Promise.resolve(), ORDERS_CHUNK);
      expect(held('p7Lm2QdE.2')).toBe(held('b0Ye4_Hs.7'));
    });
  });

  describe('on a page that stayed open while the app was deployed again', () => {
    // The file of each build whose name is the same in every build: what
    // names the locale's files now, and how the build assigned its messages
    const CURRENT = '/assets/gt-current.json';
    const ASSIGNMENT = 'a1b2c3d4';
    const NEXT_ORDERS_FILE = '/assets/Orders-b2.fr.99999999.json';
    // The host has the files of the build it serves now, and the page those
    // of the build before: the entry's, which it loaded as it started
    const DEPLOYED: Files = {
      '/assets/index-a1.fr.11111111.json':
        FILES['/assets/index-a1.fr.11111111.json'],
      [CURRENT]: { v: { fr: '99999999', de: '77777777' }, c: ASSIGNMENT },
      [NEXT_ORDERS_FILE]: { [ORDERS]: 'Commandes, encore' },
    };
    const writeOpen = (state: Partial<ChunkTranslationsState> = {}) =>
      writeState({ n: 'assets/gt-current', c: ASSIGNMENT, ...state });
    /** The URLs requested, without what makes each reading of CURRENT new. */
    const urls = (fetched: ReturnType<typeof serve>) =>
      fetched.mock.calls.map(([url]) => url.split('?')[0]);
    const state = () =>
      (globalThis as { __GT_CHUNK_TRANSLATIONS__?: ChunkTranslationsState })
        .__GT_CHUNK_TRANSLATIONS__!;

    it('reads the names of the build that is served now when a file is missing, and requests the file by its name there', async () => {
      const files = { ...DEPLOYED };
      const fetched = serve(files);
      writeOpen();
      await start();
      fetched.mockClear();

      expect(await preloadedImport([])()).toEqual({
        evaluated: 'Commandes, encore',
      });
      expect(urls(fetched)).toEqual([ORDERS_FILE, CURRENT, NEXT_ORDERS_FILE]);
      // Past the browser's cache and, by its query, a host's
      expect(fetched.mock.calls[1]).toEqual([
        expect.stringMatching(/^\/assets\/gt-current\.json\?\d+$/),
        { cache: 'no-store' },
      ]);
      expect(warn).not.toHaveBeenCalled();

      // A file the page has yet to ask for is named as that build names it
      fetched.mockClear();
      files['/assets/Reports-d4.fr.99999999.json'] = {};
      await loadChunkTranslations(['assets/Reports-d4']);
      expect(urls(fetched)).toEqual(['/assets/Reports-d4.fr.99999999.json']);
    });

    it('reads those names once for the files of an import that are missing together', async () => {
      const fetched = serve({
        ...DEPLOYED,
        '/assets/Badge-c3.fr.99999999.json': {},
      });
      writeOpen();
      await start();
      fetched.mockClear();

      await loadChunkTranslations(['assets/Orders-b2', 'assets/Badge-c3']);
      expect(urls(fetched).sort()).toEqual(
        [
          ORDERS_FILE,
          '/assets/Badge-c3.fr.22222222.json',
          CURRENT,
          NEXT_ORDERS_FILE,
          '/assets/Badge-c3.fr.99999999.json',
        ].sort()
      );
      expect(orders()).toBe('Commandes, encore');
      expect(warn).not.toHaveBeenCalled();
    });

    it('takes a page in place of the file, as a host answers that has a page for every path, for a missing file', async () => {
      const fetched = serve({
        ...DEPLOYED,
        [ORDERS_FILE]: () =>
          Promise.resolve(new Response('<!doctype html><title>App</title>')),
      });
      writeOpen();
      await start();

      expect(await preloadedImport([])()).toEqual({
        evaluated: 'Commandes, encore',
      });
      expect(urls(fetched)).toContain(CURRENT);
      expect(warn).not.toHaveBeenCalled();
    });

    it.each([
      ['has no such file', undefined, ORDERS_FILE],
      [
        'names the files as the page does',
        { v: { fr: '22222222' }, c: ASSIGNMENT },
        ORDERS_FILE,
      ],
      ['is not what a build writes', ['fr'], ORDERS_FILE],
      // A deploy that changed JavaScript: a file of the same key can hold
      // other messages there, as where the entry now holds one of them
      [
        'serves a build that assigned messages to files differently',
        { v: { fr: '99999999' }, c: 'e5f6a7b8' },
        ORDERS_FILE,
      ],
      [
        'does not say how its build assigned them',
        { v: { fr: '99999999' } },
        ORDERS_FILE,
      ],
      [
        'names files the host does not have either',
        { v: { fr: '88888888' }, c: ASSIGNMENT },
        '/assets/Orders-b2.fr.88888888.json',
      ],
    ])(
      'renders the source, warns once and runs the import when the host %s',
      async (_name, current, warned) => {
        const files = { ...DEPLOYED, [CURRENT]: current };
        const fetched = serve(files);
        writeOpen();
        await start();
        fetched.mockClear();

        expect(await preloadedImport([])()).toEqual({ evaluated: 'Orders' });
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toContain(
          `Could not load the translations in ${warned}`
        );
        expect(urls(fetched).filter((url) => url === CURRENT)).toHaveLength(1);
      }
    );

    it('does not read those names again for a file they gave no other name, and follows a later deploy and a return to the first build', async () => {
      const files = {
        ...DEPLOYED,
        [CURRENT]: { v: { fr: '22222222' }, c: ASSIGNMENT },
      };
      const fetched = serve(files);
      writeOpen();
      await start();
      await preloadedImport([])();
      fetched.mockClear();

      // The next import asks for the file again, and for nothing else
      await plainImport([])();
      expect(urls(fetched)).toEqual([ORDERS_FILE]);

      // A deploy later, another file is missing: the page reads the names,
      // and the first file is asked for by its name there
      files[CURRENT] = DEPLOYED[CURRENT];
      fetched.mockClear();
      await loadChunkTranslations(['assets/Badge-c3']);
      expect(urls(fetched)).toEqual([
        '/assets/Badge-c3.fr.22222222.json',
        CURRENT,
        '/assets/Badge-c3.fr.99999999.json',
      ]);
      fetched.mockClear();
      await plainImport([])();
      expect(urls(fetched)).toEqual([NEXT_ORDERS_FILE]);
      expect(orders()).toBe('Commandes, encore');

      // The host serves the first build again
      Object.assign(files, {
        [CURRENT]: { v: { fr: '22222222' }, c: ASSIGNMENT },
        '/assets/Reports-d4.fr.22222222.json': {},
      });
      fetched.mockClear();
      await loadChunkTranslations(['assets/Reports-d4']);
      expect(urls(fetched)).toEqual([
        '/assets/Reports-d4.fr.99999999.json',
        CURRENT,
        '/assets/Reports-d4.fr.22222222.json',
      ]);
      expect(warn).toHaveBeenCalledTimes(3);
    });

    it.each([
      ['an error of the host', new Response('Busy', { status: 503 })],
      ['a request that fails', undefined],
    ])('reads no names for %s', async (_name, response) => {
      const fetched = serve({
        ...DEPLOYED,
        [ORDERS_FILE]: () =>
          response
            ? Promise.resolve(response)
            : Promise.reject(new TypeError('Failed to fetch')),
      });
      writeOpen();
      await start();

      expect(await preloadedImport([])()).toEqual({ evaluated: 'Orders' });
      expect(urls(fetched)).not.toContain(CURRENT);
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('stops waiting when those names do not arrive within the timeout of the file', async () => {
      serve({ ...DEPLOYED, [CURRENT]: () => new Promise<Response>(() => {}) });
      writeOpen({ w: 20 });
      await start();

      expect(await preloadedImport([])()).toEqual({ evaluated: 'Orders' });
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('did not load within 20 ms');
    });

    /** A response that takes `ms`. */
    const after = (ms: number, file: unknown) => () =>
      new Promise<Response>((resolve) =>
        setTimeout(() => resolve(new Response(JSON.stringify(file))), ms)
      );

    it('renders the source at once while the names are later than the timeout, asks for the file by its current name when they arrive, and is translated from then on', async () => {
      const fetched = serve({
        ...DEPLOYED,
        [CURRENT]: after(150, DEPLOYED[CURRENT]),
      });
      writeOpen({ w: 40 });
      await start();
      fetched.mockClear();
      vi.useFakeTimers();

      // The first import waits for the file's timeout, and no longer
      const steps: string[] = [];
      const first = preloadedImport(steps)();
      await vi.advanceTimersByTimeAsync(39);
      expect(steps).toEqual([PRELOAD]);
      await vi.advanceTimersByTimeAsync(1);
      expect(await first).toEqual({ evaluated: 'Orders' });
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('did not load within 40 ms');

      // A second, while the names are still on their way: a file that was
      // late is not waited for again, and nothing more is asked for
      const second = plainImport([])();
      await vi.advanceTimersByTimeAsync(0);
      expect(await second).toEqual({ evaluated: 'Orders' });
      expect(urls(fetched)).toEqual([ORDERS_FILE, CURRENT]);

      // The names arrive: the file is asked for by its name there, and added
      await vi.advanceTimersByTimeAsync(110);
      expect(urls(fetched)).toEqual([ORDERS_FILE, CURRENT, NEXT_ORDERS_FILE]);
      expect(orders()).toBe('Commandes, encore');

      // An import after that is translated, and asks for nothing
      const third = plainImport([])();
      await vi.advanceTimersByTimeAsync(0);
      expect(await third).toEqual({ evaluated: 'Commandes, encore' });
      expect(urls(fetched)).toHaveLength(3);
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('reads nothing in a build that wrote no such file', async () => {
      const fetched = serve(DEPLOYED);
      writeState();
      await start();
      fetched.mockClear();

      expect(await preloadedImport([])()).toEqual({ evaluated: 'Orders' });
      expect(urls(fetched)).toEqual([ORDERS_FILE]);
      expect(warn).toHaveBeenCalledTimes(1);
    });

    describe('in a build that names each file by its own hash', () => {
      const MAP = '/assets/gt-map.fr.22222222.json';
      const ENTRY_FILE = '/assets/gt.fr.11111111.json';
      const file = (hash: string) => `/assets/gt.fr.${hash}.json`;
      const map = (name: string) => `/assets/gt-map.fr.${name}.json`;
      // Orders needs its own file and Badge's; the others their own
      const KEYS = [
        'assets/Badge-c3',
        'assets/Orders-b2',
        'assets/Reports-d4',
        'assets/Settings-e5',
        'assets/Help-f6',
      ];
      const listed = (...hashes: (string | 0)[]) => ({
        i: { k: KEYS, c: [0, [1, 0, 1], [1], [1], [1]], h: hashes },
      });
      const OWN = listed(
        'b0000000',
        'a0000000',
        'c0000000',
        'd0000000',
        'e0000000'
      );
      // A deploy changed a translation of Orders, of Badge and of Help
      const NEXT = listed(
        'b1111111',
        'a1111111',
        'c0000000',
        'd0000000',
        'e1111111'
      );
      const names = (name: string) => ({ v: { fr: name }, c: ASSIGNMENT });
      const startOpen = async (files: Files) => {
        const fetched = serve(files);
        writeOpen({ f: 'assets/gt', k: 'assets/gt-map' });
        await initializeMappedChunkTranslations(initializeGTSPA, CONFIG);
        await tick();
        fetched.mockClear();
        return fetched;
      };
      const BUILT: Files = {
        [ENTRY_FILE]: { t: { [SAVE]: 'Enregistrer' } },
        [MAP]: OWN,
      };
      const DEPLOYED_MAP: Files = {
        ...BUILT,
        [CURRENT]: names('99999999'),
        [map('99999999')]: NEXT,
        [file('a1111111')]: { [ORDERS]: 'Commandes, encore' },
        [file('b1111111')]: { [SAVE]: 'Enregistrer, encore' },
        [file('c0000000')]: {},
        [file('d0000000')]: {},
      };

      it('reads the map of the build that is served now, and requests each missing file by its name there', async () => {
        const fetched = await startOpen(DEPLOYED_MAP);

        expect(await preloadedImport([])(loadMappedChunk)).toEqual({
          evaluated: 'Commandes, encore',
        });
        expect(urls(fetched)).toEqual([
          file('a0000000'),
          file('b0000000'),
          CURRENT,
          map('99999999'),
          file('a1111111'),
          file('b1111111'),
        ]);
        expect(warn).not.toHaveBeenCalled();
        // The lists and the names the page's own build gave are untouched
        expect(state().i).toEqual(OWN.i);

        // What the page has asked for is not asked for again
        fetched.mockClear();
        await preloadedImport([])(loadMappedChunk);
        expect(fetched).not.toHaveBeenCalled();
      });

      it('keeps the file it has loaded for a chunk, and asks for one it has yet to ask for by its name in that build', async () => {
        // The page has loaded Badge's file. Settings has another name too
        const files: Files = {
          ...BUILT,
          [file('b0000000')]: { [SAVE]: 'Enregistrer' },
        };
        const fetched = await startOpen(files);
        await loadMappedChunkTranslations(['assets/Badge-c3']);
        Object.assign(files, {
          ...DEPLOYED_MAP,
          [map('99999999')]: listed(
            'b1111111',
            'a1111111',
            'c0000000',
            'd1111111',
            'e1111111'
          ),
          [file('d1111111')]: {},
        });
        delete files[file('b0000000')];
        fetched.mockClear();

        expect(await preloadedImport([])(loadMappedChunk)).toEqual({
          evaluated: 'Commandes, encore',
        });
        // Badge's file is not asked for by its new name
        expect(urls(fetched)).toEqual([
          file('a0000000'),
          CURRENT,
          map('99999999'),
          file('a1111111'),
        ]);
        expect(save()).toBe('Enregistrer');

        fetched.mockClear();
        await loadMappedChunkTranslations([
          'assets/Badge-c3',
          'assets/Settings-e5',
        ]);
        expect(urls(fetched)).toEqual([file('d1111111')]);
        expect(save()).toBe('Enregistrer');
        expect(warn).not.toHaveBeenCalled();
      });

      it('renders the source at once while the names are later than the timeout, and is translated once they and the map have arrived', async () => {
        const files: Files = {
          ...DEPLOYED_MAP,
          [CURRENT]: after(150, names('99999999')),
        };
        const fetched = serve(files);
        writeOpen({ f: 'assets/gt', k: 'assets/gt-map', w: 40 });
        await initializeMappedChunkTranslations(initializeGTSPA, CONFIG);
        await tick();
        fetched.mockClear();
        vi.useFakeTimers();

        const steps: string[] = [];
        const first = preloadedImport(steps)(loadMappedChunk);
        await vi.advanceTimersByTimeAsync(39);
        expect(steps).toEqual([PRELOAD]);
        await vi.advanceTimersByTimeAsync(1);
        expect(await first).toEqual({ evaluated: 'Orders' });

        // A second import while the names are on their way asks for nothing
        const second = preloadedImport([])(loadMappedChunk);
        await vi.advanceTimersByTimeAsync(0);
        expect(await second).toEqual({ evaluated: 'Orders' });
        expect(urls(fetched)).toEqual([
          file('a0000000'),
          file('b0000000'),
          CURRENT,
        ]);

        await vi.advanceTimersByTimeAsync(110);
        expect(urls(fetched)).toEqual([
          file('a0000000'),
          file('b0000000'),
          CURRENT,
          map('99999999'),
          file('a1111111'),
          file('b1111111'),
        ]);
        expect(orders()).toBe('Commandes, encore');

        // An import after that is translated, and asks for nothing
        const third = preloadedImport([])(loadMappedChunk);
        await vi.advanceTimersByTimeAsync(0);
        expect(await third).toEqual({ evaluated: 'Commandes, encore' });
        expect(urls(fetched)).toHaveLength(6);
        // One warning for each of the two files that were late
        expect(warn).toHaveBeenCalledTimes(2);
      });

      it('asks again for a file in place of a missing one after it failed', async () => {
        const files: Files = {
          ...DEPLOYED_MAP,
          [file('a1111111')]: () =>
            Promise.resolve(new Response('Busy', { status: 503 })),
        };
        const fetched = await startOpen(files);
        expect(await preloadedImport([])(loadMappedChunk)).toEqual({
          evaluated: 'Orders',
        });
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toContain(file('a1111111'));

        // The host has it by the next import
        files[file('a1111111')] = DEPLOYED_MAP[file('a1111111')];
        fetched.mockClear();
        expect(await preloadedImport([])(loadMappedChunk)).toEqual({
          evaluated: 'Commandes, encore',
        });
        expect(urls(fetched)).toEqual([file('a1111111')]);
      });

      it('follows a second deploy, and a return to an earlier build and to its own', async () => {
        const files: Files = { ...DEPLOYED_MAP };
        const fetched = await startOpen(files);
        await preloadedImport([])(loadMappedChunk);

        // A second deploy changed a translation of Reports and of Settings
        Object.assign(files, {
          [CURRENT]: names('88888888'),
          [map('88888888')]: listed(
            'b1111111',
            'a1111111',
            'c2222222',
            'd2222222',
            'e1111111'
          ),
          [file('c2222222')]: {},
        });
        delete files[file('c0000000')];
        delete files[file('d0000000')];
        fetched.mockClear();
        await loadMappedChunkTranslations(['assets/Reports-d4']);
        expect(urls(fetched)).toEqual([
          file('c0000000'),
          CURRENT,
          map('88888888'),
          file('c2222222'),
        ]);

        // The host serves the build of the first deploy again
        Object.assign(files, {
          [CURRENT]: names('99999999'),
          [file('d0000000')]: {},
        });
        fetched.mockClear();
        await loadMappedChunkTranslations(['assets/Settings-e5']);
        expect(urls(fetched)).toEqual([
          file('d2222222'),
          CURRENT,
          map('99999999'),
          file('d0000000'),
        ]);
        expect(warn).not.toHaveBeenCalled();

        // And then the page's own, which it holds the map of
        Object.assign(files, {
          [CURRENT]: names('22222222'),
          [file('e0000000')]: {},
        });
        fetched.mockClear();
        await loadMappedChunkTranslations(['assets/Help-f6']);
        expect(urls(fetched)).toEqual([
          file('e1111111'),
          CURRENT,
          file('e0000000'),
        ]);
        expect(state().j).toBeUndefined();
        expect(warn).not.toHaveBeenCalled();
      });

      it.each([
        // A deploy that changed JavaScript: no map is read
        [
          'serves a build that assigned messages to files differently',
          { [CURRENT]: { v: { fr: '99999999' }, c: 'e5f6a7b8' } },
          [file('a0000000'), file('b0000000'), CURRENT],
        ],
        [
          'has no such map',
          { [map('99999999')]: undefined },
          [file('a0000000'), file('b0000000'), CURRENT, map('99999999')],
        ],
        [
          'names the files as the page does',
          { [map('99999999')]: OWN },
          [file('a0000000'), file('b0000000'), CURRENT, map('99999999')],
        ],
        [
          'has no such files in the locale',
          { [map('99999999')]: listed(0, 0, 'c0000000', 'd0000000', 0) },
          [file('a0000000'), file('b0000000'), CURRENT, map('99999999')],
        ],
      ])(
        'renders the source and warns of each file when the host %s',
        async (_name, files, asked) => {
          const fetched = await startOpen({ ...DEPLOYED_MAP, ...files });

          expect(await preloadedImport([])(loadMappedChunk)).toEqual({
            evaluated: 'Orders',
          });
          expect(urls(fetched)).toEqual(asked);
          expect(warn.mock.calls.map(([message]) => message)).toEqual(
            [file('a0000000'), file('b0000000')].map((url) =>
              expect.stringContaining(
                `Could not load the translations in ${url}`
              )
            )
          );
          expect(state().i).toEqual(OWN.i);
        }
      );
    });
  });

  describe('in a build that names each file by its own hash', () => {
    const MAP = '/assets/gt-map.fr.22222222.json';
    // Named by the locale and the hash of what they hold, and by no chunk
    const ENTRY_FILE = '/assets/gt.fr.11111111.json';
    const MAPPED_ORDERS_FILE = '/assets/gt.fr.33333333.json';
    // What names a chunk is in the map: the import of the Orders chunk also
    // needs the file of a shared chunk, which this locale has none of
    const LISTED = {
      i: {
        k: ['assets/Badge-c3', 'assets/Orders-b2'],
        c: [0, [1, 0, 1]],
        h: [0, '33333333'],
      },
    };
    const MAPPED: Files = {
      [ENTRY_FILE]: { t: { [SAVE]: 'Enregistrer' } },
      [MAP]: LISTED,
      [MAPPED_ORDERS_FILE]: { [ORDERS]: 'Commandes' },
    };
    const writeMapped = (state: Partial<ChunkTranslationsState> = {}) =>
      writeState({ f: 'assets/gt', k: 'assets/gt-map', ...state });
    const startMapped = () =>
      initializeMappedChunkTranslations(initializeGTSPA, CONFIG);

    it('reads the map when the app starts, then requests the files it lists with their imports', async () => {
      const fetched = serve(MAPPED);
      writeMapped();
      await startMapped();
      await tick();
      expect(fetched.mock.calls.flat().sort()).toEqual(
        [ENTRY_FILE, MAP].sort()
      );
      fetched.mockClear();

      // The map lists no file for the second chunk
      expect(await preloadedImport([])(loadMappedChunk)).toEqual({
        evaluated: 'Commandes',
      });

      expect(fetched.mock.calls).toEqual([[MAPPED_ORDERS_FILE]]);
      expect(warn).not.toHaveBeenCalled();
    });

    it('requests a file that two chunks have once', async () => {
      const fetched = serve({
        ...MAPPED,
        [MAP]: {
          i: {
            k: ['assets/Orders-b2', 'assets/Settings-e5'],
            c: [[1], [1]],
            h: ['33333333', '33333333'],
          },
        },
      });
      writeMapped();
      await startMapped();
      await tick();
      fetched.mockClear();

      await Promise.all([
        plainImport([])(loadMappedChunk),
        loadMappedChunk(evaluate([]), 'assets/Settings-e5.js'),
      ]);

      expect(fetched.mock.calls).toEqual([[MAPPED_ORDERS_FILE]]);
      expect(orders()).toBe('Commandes');
    });

    it("waits for the entry's file too, when the import starts before it has arrived", async () => {
      const entry = hold(MAPPED[ENTRY_FILE]);
      const fetched = serve({ ...MAPPED, [ENTRY_FILE]: entry.response });
      writeMapped();
      const starting = startMapped();
      const steps: string[] = [];

      const loading = preloadedImport(steps)(loadMappedChunk);
      await tick();
      // The map and the file it lists have arrived
      expect(fetched.mock.calls.flat()).toEqual([
        ENTRY_FILE,
        MAP,
        MAPPED_ORDERS_FILE,
      ]);
      expect(steps).toEqual([PRELOAD]);

      entry.respond();
      expect(await loading).toEqual({ evaluated: 'Commandes' });
      await starting;
      expect(save()).toBe('Enregistrer');
    });

    it('runs an import once the map and then the files it lists have arrived', async () => {
      const map = hold(MAPPED[MAP]);
      const fetched = serve({ ...MAPPED, [MAP]: map.response });
      writeMapped();
      await startMapped();
      fetched.mockClear();
      const steps: string[] = [];

      const loading = preloadedImport(steps)(loadMappedChunk);
      await tick();
      // The chunk downloads while the map does; no file can be named yet
      expect(steps).toEqual([PRELOAD]);
      expect(fetched).not.toHaveBeenCalled();

      map.respond();
      expect(await loading).toEqual({ evaluated: 'Commandes' });
      expect(fetched.mock.calls).toEqual([[MAPPED_ORDERS_FILE]]);
    });

    it('reads the requests the startup script made instead of making others', async () => {
      const fetched = serve(MAPPED);
      writeMapped({
        l: 'fr',
        p: { fr: Promise.resolve({ t: { [SAVE]: 'Du script' } }) },
        m: { fr: Promise.resolve(LISTED) },
        // By the hash of the file, which more than one chunk can have
        g: { 'fr 33333333': Promise.resolve({ [ORDERS]: 'Du lien' }) },
      });

      await startMapped();
      await plainImport([])(loadMappedChunk);

      expect(fetched).not.toHaveBeenCalled();
      expect(orders()).toBe('Du lien');
    });

    it('renders the source of what the map would have found and warns when the map is missing', async () => {
      const files = { ...MAPPED };
      delete files[MAP];
      serve(files);
      writeMapped();

      await startMapped();
      expect(await preloadedImport([])(loadMappedChunk)).toEqual({
        evaluated: 'Orders',
      });

      expect(save()).toBe('Enregistrer');
      expect(warn.mock.calls[0][0]).toContain(
        `Could not load the translations in ${MAP}`
      );
    });
  });

  describe('in a build that splits by module', () => {
    const MAP = '/assets/gt-map.fr.11111111.json';
    const SHELL = '/assets/gt-aa.fr.44444444.json';
    const SHARED = '/assets/gt-bb.fr.55555555.json';
    const ROUTE = '/assets/gt-cc.fr.66666666.json';
    const TITLE = '3f85538d4b215b91';
    // The import of the Orders chunk needs the entry's file, a file other
    // imports need too, one the locale has no translations for, and its own
    const LISTED = {
      k: [
        'assets/gt-aa',
        'assets/gt-bb',
        'assets/gt-dd',
        'assets/gt-cc',
        'assets/Orders-b2',
      ],
      c: [0, 0, 0, 0, [0, 0, 4]],
      h: ['44444444', '55555555', 0, '66666666'],
    };
    const SPLIT: Files = {
      [MAP]: { i: LISTED },
      [SHELL]: { [SAVE]: 'Enregistrer' },
      [SHARED]: { [TITLE]: 'Aperçu' },
      [ROUTE]: { [ORDERS]: 'Commandes' },
    };
    const title = () => t({ $_hash: TITLE } as never)`Overview`;
    /** What the startup script leaves: the map is the file it names. */
    const writeSplitState = (state: Partial<ChunkTranslationsState> = {}) =>
      writeState({
        f: 'assets/gt-map',
        v: {},
        e: { fr: { 'assets/gt-aa': '44444444' } },
        ...state,
      });
    const startSplit = () =>
      initializeRegionChunkTranslations(initializeGTSPA, CONFIG);

    it("starts with the entry's files and the map, then requests the other files an import needs", async () => {
      const fetched = serve(SPLIT);
      writeSplitState();
      await startSplit();
      await tick();
      expect(fetched.mock.calls.flat().sort()).toEqual([MAP, SHELL].sort());
      expect(save()).toBe('Enregistrer');
      expect(title()).toBe('Overview');
      fetched.mockClear();

      expect(await preloadedImport([])(loadRegionChunk)).toEqual({
        evaluated: 'Commandes',
      });

      // Not the entry's file, which the page holds, nor one without a name
      expect(fetched.mock.calls.flat().sort()).toEqual([ROUTE, SHARED].sort());
      expect(title()).toBe('Aperçu');
      fetched.mockClear();
      await preloadedImport([])(loadRegionChunk);
      expect(fetched).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
    });

    it('starts without waiting for the map, and runs an import once the map and every file it lists have arrived', async () => {
      const map = hold(SPLIT[MAP]);
      const route = hold(SPLIT[ROUTE]);
      const fetched = serve({
        ...SPLIT,
        [MAP]: map.response,
        [ROUTE]: route.response,
      });
      writeSplitState();
      await startSplit();
      fetched.mockClear();
      const steps: string[] = [];

      const loading = preloadedImport(steps)(loadRegionChunk);
      await tick();
      // The chunk downloads while the map does; no file can be named yet
      expect(steps).toEqual([PRELOAD]);
      expect(fetched).not.toHaveBeenCalled();

      map.respond();
      await tick();
      expect(fetched.mock.calls.flat().sort()).toEqual([ROUTE, SHARED].sort());
      expect(steps).toEqual([PRELOAD]);

      route.respond();
      expect(await loading).toEqual({ evaluated: 'Commandes' });
      expect(steps).toEqual([PRELOAD, 'import']);
    });

    it("waits for the entry's files too when an import starts before they have arrived", async () => {
      const shell = hold(SPLIT[SHELL]);
      serve({ ...SPLIT, [SHELL]: shell.response });
      // Before initializeGTSPA(): the locale is the startup script's
      writeSplitState({ l: 'fr' });
      const steps: string[] = [];

      const loading = loadRegionChunk(() => {
        // Before initializeGTSPA() the files wait for the cache's first load
        const arrived = (
          globalThis as { __GT_CHUNK_TRANSLATIONS__?: ChunkTranslationsState }
        ).__GT_CHUNK_TRANSLATIONS__?.t?.fr;
        steps.push(`import ${arrived?.[SAVE]}`);
        return Promise.resolve({});
      }, ORDERS_CHUNK);
      await tick();
      expect(steps).toEqual([]);

      shell.respond();
      await loading;
      expect(steps).toEqual(['import Enregistrer']);
    });

    it('reads the requests the startup script made instead of making others', async () => {
      const fetched = serve(SPLIT);
      writeSplitState({
        l: 'fr',
        p: { fr: Promise.resolve({ i: LISTED }) },
        g: {
          'fr assets/gt-aa': Promise.resolve({ [SAVE]: 'Du script' }),
          'fr assets/gt-cc': Promise.resolve({ [ORDERS]: 'Du lien' }),
        },
      });

      await startSplit();
      await plainImport([])(loadRegionChunk);

      expect(fetched.mock.calls).toEqual([[SHARED]]);
      expect(save()).toBe('Du script');
      expect(orders()).toBe('Du lien');
    });

    it('loads the files of a chunk by their keys for an app that preloads chunks itself', async () => {
      const fetched = serve(SPLIT);
      writeSplitState();
      await startSplit();
      fetched.mockClear();

      await loadRegionChunkTranslations(['assets/gt-cc', 'assets/gt-aa']);

      expect(fetched.mock.calls).toEqual([[ROUTE]]);
      expect(orders()).toBe('Commandes');
      expect(loadRegionChunkTranslations([])).toBeUndefined();
    });

    it.each([
      [
        'the map',
        MAP,
        { save: 'Enregistrer', title: 'Overview', orders: 'Orders' },
      ],
      [
        "one of an import's files",
        SHARED,
        { save: 'Enregistrer', title: 'Overview', orders: 'Commandes' },
      ],
      [
        "the entry's file",
        SHELL,
        { save: 'Save', title: 'Aperçu', orders: 'Commandes' },
      ],
    ])(
      'renders the source of what %s would have brought, and warns, when it is missing',
      async (_name, missing, expected) => {
        const files = { ...SPLIT };
        delete files[missing];
        serve(files);
        writeSplitState();

        await startSplit();
        await preloadedImport([])(loadRegionChunk);

        expect({ save: save(), title: title(), orders: orders() }).toEqual(
          expected
        );
        expect(warn.mock.calls[0][0]).toContain(
          `Could not load the translations in ${missing}`
        );
      }
    );

    it('requests nothing in a locale that renders the source', async () => {
      const fetched = serve(SPLIT);
      writeSplitState();
      setLocale('en');
      const steps: string[] = [];

      await startSplit();
      await preloadedImport(steps)(loadRegionChunk);

      expect(fetched).not.toHaveBeenCalled();
      expect(steps).toEqual([PRELOAD, 'import']);
      expect(links()).toEqual([]);
    });

    describe('on a page that stayed open while the app was deployed again', () => {
      const CURRENT = '/assets/gt-current.json';
      const NEXT_MAP = '/assets/gt-map.fr.99999999.json';
      // The deploy changed a translation, and its build split the messages
      // differently: the Orders chunk now needs the entry's file, which is
      // as it was, and one file of the two it needed. That one has the key
      // of a file the page's build had, and holds other messages
      const NEXT_SHARED = '/assets/gt-bb.fr.77777777.json';
      const NEXT_LISTED = {
        k: ['assets/gt-aa', 'assets/gt-bb', 'assets/Orders-b2'],
        c: [0, 0, [0, 0, 2]],
        h: ['44444444', '77777777'],
      };
      const DEPLOYED: Files = {
        [MAP]: SPLIT[MAP],
        [SHELL]: SPLIT[SHELL],
        [CURRENT]: { v: { fr: '99999999' } },
        [NEXT_MAP]: { i: NEXT_LISTED },
        [NEXT_SHARED]: {
          [TITLE]: 'Aperçu, encore',
          [ORDERS]: 'Commandes, encore',
        },
      };
      const urls = (fetched: ReturnType<typeof serve>) =>
        fetched.mock.calls.map(([url]) => url.split('?')[0]);
      const startOpen = async (files: Files) => {
        const fetched = serve(files);
        writeSplitState({ n: 'assets/gt-current' });
        await startSplit();
        await tick();
        fetched.mockClear();
        return fetched;
      };
      const state = () =>
        (globalThis as { __GT_CHUNK_TRANSLATIONS__?: ChunkTranslationsState })
          .__GT_CHUNK_TRANSLATIONS__!;

      it('reads the lists of the build that is served now when a file is missing, and requests what they list for the chunk', async () => {
        const fetched = await startOpen(DEPLOYED);

        expect(await preloadedImport([])(loadRegionChunk)).toEqual({
          evaluated: 'Commandes, encore',
        });
        // Both files of the page's build are gone: one reading serves both
        expect(urls(fetched)).toEqual([
          SHARED,
          ROUTE,
          CURRENT,
          NEXT_MAP,
          NEXT_SHARED,
        ]);
        expect(title()).toBe('Aperçu, encore');
        expect(warn).not.toHaveBeenCalled();
        // The page's own lists are as they were
        expect(state().i).toEqual(LISTED);

        // The chunk is then listed by that build: nothing is asked for twice
        fetched.mockClear();
        await preloadedImport([])(loadRegionChunk);
        expect(fetched).not.toHaveBeenCalled();
      });

      it('with hash minification, takes from a file of that build what its own chunks still read, and no other message for a chunk the deploy changed', async () => {
        // The Orders chunk is as it was, so its id is. The chunk that reads
        // the title gained a message, which makes its messages another list
        // in the build that is served now: the title's place in the page's
        // list is the new message's place there
        const ordersId = 'Xk3_9aQz.0';
        const pageTitle = t({ $_hash: 'mT7cR-1v.0' } as never);
        const fetched = await startOpen({
          ...DEPLOYED,
          [NEXT_SHARED]: [
            ['Commandes, encore', 'Nouveau', 'Aperçu, encore'],
            { Xk3_9aQz: [0, 0, 1], b0Ye4_Hs: [0, 1, 2] },
          ],
        });

        await loadRegionChunk(
          () => Promise.resolve(),
          0,
          (start) => start(),
          [ORDERS_CHUNK]
        );
        expect(urls(fetched)).toContain(NEXT_SHARED);
        expect(t({ $_hash: ordersId } as never)`Orders`).toBe(
          'Commandes, encore'
        );
        // A miss, which renders the source: not the message that has the
        // same place in the list of that build
        expect(pageTitle`Overview`).toBe('Overview');
        expect(t({ $_hash: 'b0Ye4_Hs.0' } as never)`New`).toBe('Nouveau');
      });

      it('takes a file of that build for another file than the one the page has by the same key', async () => {
        // The page has loaded the files of Orders. Reports needs one of
        // them and one more, which is gone
        const listed = {
          k: [...LISTED.k, 'assets/gt-ee', 'assets/Reports-d4'],
          c: [...LISTED.c, 0, [0, 1, 1, 5, 1]],
          h: [...LISTED.h, 0, '12121212'],
        };
        const files: Files = { ...SPLIT, [MAP]: { i: listed } };
        const fetched = await startOpen(files);
        await preloadedImport([])(loadRegionChunk);
        expect(title()).toBe('Aperçu');

        Object.assign(files, {
          [CURRENT]: DEPLOYED[CURRENT],
          [NEXT_MAP]: {
            i: {
              k: ['assets/gt-bb', 'assets/Reports-d4'],
              c: [0, [0, 0, 1]],
              h: ['77777777'],
            },
          },
          [NEXT_SHARED]: DEPLOYED[NEXT_SHARED],
        });
        fetched.mockClear();
        await loadRegionChunk(() => Promise.resolve(), 'assets/Reports-d4.js');
        expect(urls(fetched)).toEqual([
          '/assets/gt-ee.fr.12121212.json',
          CURRENT,
          NEXT_MAP,
          NEXT_SHARED,
        ]);
        expect(title()).toBe('Aperçu, encore');
        expect(warn).not.toHaveBeenCalled();
      });

      it.each([
        [
          'does not know the chunk, which a deploy that changed JavaScript renamed',
          { k: ['assets/gt-bb', 'assets/Orders-z9'], c: [0, [0, 0, 1]] },
        ],
        [
          'lists the file that is missing',
          {
            k: ['assets/gt-bb', 'assets/Orders-b2'],
            c: [0, [0, 0, 1]],
            h: ['55555555'],
          },
        ],
      ])(
        'renders the source, warns and keeps its own lists when that build %s',
        async (_name, lists) => {
          // The host kept the file of the route, and not the shared one
          const fetched = await startOpen({
            ...DEPLOYED,
            [ROUTE]: SPLIT[ROUTE],
            [NEXT_MAP]: { i: { h: ['77777777'], ...lists } },
          });

          expect(await preloadedImport([])(loadRegionChunk)).toEqual({
            evaluated: 'Commandes',
          });
          expect(title()).toBe('Overview');
          expect(urls(fetched)).toEqual([SHARED, ROUTE, CURRENT, NEXT_MAP]);
          expect(warn.mock.calls.map(([message]) => message)).toEqual([
            expect.stringContaining(
              `Could not load the translations in ${SHARED}`
            ),
          ]);
          expect(state().i).toEqual(LISTED);
        }
      );

      it('requests what that build lists for each chunk whose imports wait for the same missing file', async () => {
        // Orders and Reports need one file of the page's build. The build
        // that is served now has a file for each
        const listed = {
          k: ['assets/gt-bb', 'assets/Orders-b2', 'assets/Reports-d4'],
          c: [0, [0, 0, 1], [0, 0, 1]],
          h: ['55555555'],
        };
        const fetched = await startOpen({
          [MAP]: { i: listed },
          [SHELL]: SPLIT[SHELL],
          [CURRENT]: DEPLOYED[CURRENT],
          [NEXT_MAP]: {
            i: {
              k: [
                'assets/gt-ff',
                'assets/gt-gg',
                'assets/Orders-b2',
                'assets/Reports-d4',
              ],
              c: [0, 0, [0, 0, 1], [0, 1, 1]],
              h: ['12121212', '34343434'],
            },
          },
          '/assets/gt-ff.fr.12121212.json': { [ORDERS]: 'Commandes, encore' },
          '/assets/gt-gg.fr.34343434.json': { [TITLE]: 'Aperçu, encore' },
        });

        const [first, second] = await Promise.all([
          preloadedImport([])(loadRegionChunk),
          loadRegionChunk(
            () => Promise.resolve({ evaluated: title() }),
            'assets/Reports-d4.js'
          ),
        ]);
        expect([first, second]).toEqual([
          { evaluated: 'Commandes, encore' },
          { evaluated: 'Aperçu, encore' },
        ]);
        expect(urls(fetched).sort()).toEqual(
          [
            SHARED,
            CURRENT,
            NEXT_MAP,
            '/assets/gt-ff.fr.12121212.json',
            '/assets/gt-gg.fr.34343434.json',
          ].sort()
        );
        expect(warn).not.toHaveBeenCalled();
      });

      it('reads the lists again when a file they name is gone after another deploy, once', async () => {
        const REPORTS_FILE = '/assets/gt-ee.fr.12121212.json';
        const lists = (ordersHash: string, reportsHash: string) => ({
          i: {
            k: [
              'assets/gt-cc',
              'assets/gt-ee',
              'assets/Orders-b2',
              'assets/Reports-d4',
            ],
            c: [0, 0, [0, 0, 1], [0, 1, 1]],
            h: [ordersHash, reportsHash],
          },
        });
        // The page's build, and the build of a first deploy, which changed
        // a translation of Orders
        const files: Files = {
          [MAP]: lists('66666666', '12121212'),
          [SHELL]: SPLIT[SHELL],
          [CURRENT]: { v: { fr: '99999999' } },
          [NEXT_MAP]: lists('77777777', '12121212'),
          '/assets/gt-cc.fr.77777777.json': { [ORDERS]: 'Commandes, encore' },
          [REPORTS_FILE]: { [TITLE]: 'Aperçu' },
        };
        const fetched = await startOpen(files);
        await preloadedImport([])(loadRegionChunk);
        expect(orders()).toBe('Commandes, encore');

        // A second deploy changed a translation of Reports, which the page
        // has not opened
        delete files[REPORTS_FILE];
        Object.assign(files, {
          [CURRENT]: { v: { fr: '88888888' } },
          '/assets/gt-map.fr.88888888.json': lists('77777777', '34343434'),
          '/assets/gt-ee.fr.34343434.json': { [TITLE]: 'Aperçu, encore' },
        });
        fetched.mockClear();
        const reports = () =>
          loadRegionChunk(
            () => Promise.resolve({ evaluated: title() }),
            'assets/Reports-d4.js'
          );
        expect(await reports()).toEqual({ evaluated: 'Aperçu, encore' });
        expect(urls(fetched)).toEqual([
          REPORTS_FILE,
          CURRENT,
          '/assets/gt-map.fr.88888888.json',
          '/assets/gt-ee.fr.34343434.json',
        ]);
        expect(warn).not.toHaveBeenCalled();

        // A third, whose map names a file the host does not have: the file
        // is asked for once, with a warning, and nothing is read again
        Object.assign(files, {
          [CURRENT]: { v: { fr: '77777777' } },
          '/assets/gt-map.fr.77777777.json': lists('56565656', '34343434'),
        });
        delete files['/assets/gt-cc.fr.77777777.json'];
        fetched.mockClear();
        const again = () =>
          loadRegionChunk(
            () => Promise.resolve({ evaluated: orders() }),
            'assets/Orders-b2.js'
          );
        // What the page had loaded for the chunk stays
        expect(await again()).toEqual({ evaluated: 'Commandes, encore' });
        expect(urls(fetched)).toEqual([]);
      });

      describe('with files of two chunks', () => {
        const REPORTS_FILE = '/assets/gt-ee.fr.12121212.json';
        const NEXT_ORDERS = '/assets/gt-cc.fr.77777777.json';
        const lists = (ordersHash: string, reportsHash: string) => ({
          i: {
            k: [
              'assets/gt-cc',
              'assets/gt-ee',
              'assets/Orders-b2',
              'assets/Reports-d4',
            ],
            c: [0, 0, [0, 0, 1], [0, 1, 1]],
            h: [ordersHash, reportsHash],
          },
        });
        const reports = () =>
          loadRegionChunk(
            () => Promise.resolve({ evaluated: title() }),
            'assets/Reports-d4.js'
          );
        /** A response that takes `ms`. */
        const after = (ms: number, file: unknown) => () =>
          new Promise<Response>((resolve) =>
            setTimeout(() => resolve(new Response(JSON.stringify(file))), ms)
          );
        // The page's build, and a deploy that changed a translation of each
        // chunk
        const built = (): Files => ({
          [MAP]: lists('66666666', '12121212'),
          [SHELL]: SPLIT[SHELL],
          [CURRENT]: { v: { fr: '99999999' } },
          [NEXT_MAP]: lists('77777777', '34343434'),
          [NEXT_ORDERS]: { [ORDERS]: 'Commandes, encore' },
          '/assets/gt-ee.fr.34343434.json': { [TITLE]: 'Aperçu, encore' },
        });

        it("goes back to its own lists when the host serves the page's build again", async () => {
          const files = built();
          const fetched = await startOpen(files);
          await preloadedImport([])(loadRegionChunk);
          expect(orders()).toBe('Commandes, encore');

          // The host serves the page's build again: Reports, which the page
          // has not opened, has the file that build listed for it
          delete files['/assets/gt-ee.fr.34343434.json'];
          Object.assign(files, {
            [CURRENT]: { v: { fr: '11111111' } },
            [REPORTS_FILE]: { [TITLE]: 'Aperçu' },
          });
          fetched.mockClear();
          expect(await reports()).toEqual({ evaluated: 'Aperçu' });
          expect(urls(fetched)).toEqual([
            '/assets/gt-ee.fr.34343434.json',
            CURRENT,
            REPORTS_FILE,
          ]);
          expect(warn).not.toHaveBeenCalled();
        });

        it('waits for the files in place of a missing one no longer than for the file, and adds them when they arrive', async () => {
          // The lists take most of the file's timeout, and the file in its
          // place longer than what is left of it. It takes less than a whole
          // timeout, so an import that waited that long would be translated.
          const files = built();
          files[CURRENT] = after(45, { v: { fr: '99999999' } });
          files['/assets/gt-ee.fr.34343434.json'] = after(40, {
            [TITLE]: 'Aperçu, encore',
          });
          serve(files);
          writeSplitState({ n: 'assets/gt-current', w: 60 });
          await startSplit();
          await tick();

          expect(await reports()).toEqual({ evaluated: 'Overview' });

          await new Promise((resolve) => setTimeout(resolve, 200));
          expect(title()).toBe('Aperçu, encore');
        });

        it('adds the files that arrive after the timeout also when another of them failed', async () => {
          // In the build that is served, Reports needs two files. One
          // arrives after the import's timeout and within its own, and the
          // host fails the other
          const files = built();
          Object.assign(files, {
            [CURRENT]: after(80, { v: { fr: '99999999' } }),
            [NEXT_MAP]: {
              i: {
                k: ['assets/gt-ee', 'assets/gt-gg', 'assets/Reports-d4'],
                c: [0, 0, [0, 0, 2]],
                h: ['34343434', '56565656'],
              },
            },
            '/assets/gt-ee.fr.34343434.json': after(60, {
              [TITLE]: 'Aperçu, encore',
            }),
            '/assets/gt-gg.fr.56565656.json': () =>
              Promise.resolve(new Response('Busy', { status: 503 })),
          });
          serve(files);
          writeSplitState({ n: 'assets/gt-current', w: 100 });
          await startSplit();
          await tick();

          expect(await reports()).toEqual({ evaluated: 'Overview' });
          await new Promise((resolve) => setTimeout(resolve, 100));
          expect(title()).toBe('Aperçu, encore');
        });

        it('asks for the files in place of a missing one when the lists arrive after its timeout', async () => {
          const files = built();
          const lists = hold({ v: { fr: '99999999' } });
          files[CURRENT] = lists.response;
          const fetched = serve(files);
          writeSplitState({ n: 'assets/gt-current', w: 40 });
          await startSplit();
          await tick();

          // The lists, which name the file, are still on their way
          expect(await reports()).toEqual({ evaluated: 'Overview' });
          expect(urls(fetched)).not.toContain('/assets/gt-ee.fr.34343434.json');

          lists.respond();
          await tick();
          expect(urls(fetched)).toContain('/assets/gt-ee.fr.34343434.json');
          expect(title()).toBe('Aperçu, encore');
        });
      });

      it('reads nothing for files an app asks for by key', async () => {
        const fetched = await startOpen(DEPLOYED);
        await loadRegionChunkTranslations(['assets/gt-cc']);
        expect(urls(fetched)).toEqual([ROUTE]);
        expect(warn).toHaveBeenCalledTimes(1);
      });
    });
  });
});
