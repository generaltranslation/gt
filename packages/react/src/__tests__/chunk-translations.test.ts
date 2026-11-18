// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  initializeChunkTranslations,
  initializeMappedChunkTranslations,
  initializeRegionChunkTranslations,
  loadChunk,
  loadChunkTranslations,
  loadMappedChunk,
  loadRegionChunk,
  loadRegionChunkTranslations,
  type ChunkTranslationsState,
} from '../chunk-translations';
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
  const fetched = vi.fn((url: string) => {
    const file = files[url];
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
  });
});
