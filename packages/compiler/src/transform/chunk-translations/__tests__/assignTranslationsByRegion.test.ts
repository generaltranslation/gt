import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { assignTranslationsByChunk } from '../assignTranslations';
import {
  assignTranslationsByRegion,
  estimateCompressedSize,
  findUncoveredMessages,
  fitCompressedSize,
  listRegions,
  type RegionAssignment,
  type RegionGraph,
  type RegionModule,
  type RegionOptions,
} from '../assignTranslationsByRegion';
import {
  createRegionGraph,
  getMessageSizes,
  initialisesModulesLazily,
  sampleCompressedSizes,
  type RegionChunk,
} from '../createRegionGraph';
import { mergeRegions, type RegionMergeInput } from '../mergeRegions';
import {
  ADDED_MESSAGE,
  addImport,
  addMessage,
  compareFiles,
  countRegionsByLoads,
  createRandom,
  createStressApp,
  createSyntheticApp,
  describeFiles,
  describeStartup,
  getEntryWaste,
  getPrevious,
  getRegionSplit,
  measureSplit,
  type FileWaste,
  type RootImport,
  type Split,
  type SyntheticApp,
} from './syntheticApp';

const module = (
  id: string,
  hashes: string[],
  rest: Partial<RegionModule> = {}
): RegionModule => ({ id, hashes, imports: [], dynamicImports: [], ...rest });

// An entry with its shell, two routes that share a badge and a table, and a
// dialog one of the routes opens. The table and its cell import each other.
const APP: RegionGraph = {
  entries: ['main'],
  modules: [
    module('main', ['title', 'nav'], {
      imports: ['shell'],
      dynamicImports: ['home', 'orders'],
    }),
    module('shell', ['shell']),
    module('home', ['home', 'title'], { imports: ['badge', 'table'] }),
    module('orders', ['orders'], {
      imports: ['badge', 'table', 'glossary'],
      dynamicImports: ['dialog'],
    }),
    module('badge', ['badge']),
    module('table', ['table'], { imports: ['cell'] }),
    module('cell', ['cell'], { imports: ['table'] }),
    module('glossary', ['term1', 'term2']),
    module('dialog', ['dialog', 'nav'], {
      imports: ['glossary', 'badge', 'extra', 'empty'],
    }),
    module('extra', ['extra']),
    module('empty', []),
  ],
};

const sizesOf = (graph: RegionGraph, bytes = 100) =>
  new Map(
    graph.modules.flatMap((item) =>
      [...item.hashes, ...(item.initialHashes ?? [])].map(
        (hash) => [hash, bytes] as const
      )
    )
  );
const linear = (bytes: number) => bytes;
/** No merging: every region is a file. */
const exact = (graph: RegionGraph): RegionOptions => ({
  sizes: sizesOf(graph),
  requestCost: 0,
  estimateSize: linear,
});
const HUGE = 1e9;

const plain = (assignment: RegionAssignment) => ({
  entries: [...assignment.entries],
  files: [...assignment.files],
  imports: [...assignment.imports],
});

function expectPartition(graph: RegionGraph, assignment: RegionAssignment) {
  const assigned = [...assignment.files.values()].flat();
  const hashes = new Set(
    graph.modules.flatMap((item) => [
      ...item.hashes,
      ...(item.initialHashes ?? []),
    ])
  );
  expect(assigned.length).toBe(hashes.size);
  expect(new Set(assigned)).toEqual(hashes);
}

describe('assignTranslationsByRegion', () => {
  it('puts the messages that the same loads fetch into one file', () => {
    const assignment = assignTranslationsByRegion(APP, exact(APP));
    expect(Object.fromEntries(assignment.files)).toEqual({
      // What the routes share, with the cell behind the import cycle
      badge: ['badge', 'cell', 'table'],
      dialog: ['dialog', 'extra'],
      home: ['home'],
      // Everything the entry demands, whatever else demands it
      nav: ['nav', 'shell', 'title'],
      // The dialog only opens from orders, which holds the glossary by then
      orders: ['orders', 'term1', 'term2'],
    });
    expect(Object.fromEntries(assignment.entries)).toEqual({ main: ['nav'] });
    expect(Object.fromEntries(assignment.imports)).toEqual({
      dialog: ['badge', 'dialog', 'orders'],
      home: ['badge', 'home'],
      orders: ['badge', 'orders'],
    });
    expect(assignment.getImportedFiles('orders', 'dialog')).toEqual(['dialog']);
    expect(assignment.getImportedFiles('main', 'home')).toEqual([
      'badge',
      'home',
    ]);
    expect(assignment.getImportedFiles('main', 'missing')).toEqual([]);
    // Every file an import reads from, the entry's included
    expect(Object.fromEntries(assignment.demands)).toEqual({
      dialog: ['badge', 'dialog', 'nav', 'orders'],
      home: ['badge', 'home', 'nav'],
      orders: ['badge', 'orders'],
    });
    expect(assignment.stats).toMatchObject({ loads: 4, regions: 5 });
    expectPartition(APP, assignment);
    expect(findUncoveredMessages(APP, assignment)).toEqual([]);
  });

  it('merges every file that shares a load when a request costs far more than bytes', () => {
    const assignment = assignTranslationsByRegion(APP, {
      ...exact(APP),
      requestCost: HUGE,
    });
    // Also what only the dialog demands: orders holds the badge by then, so
    // in one file with it the dialog requests nothing
    expect(Object.fromEntries(assignment.files)).toEqual({
      badge: [
        'badge',
        'cell',
        'dialog',
        'extra',
        'home',
        'nav',
        'orders',
        'shell',
        'table',
        'term1',
        'term2',
        'title',
      ],
    });
    expect(Object.fromEntries(assignment.entries)).toEqual({ main: ['badge'] });
    expect(Object.fromEntries(assignment.imports)).toEqual({
      dialog: [],
      home: [],
      orders: [],
    });
    expect(Object.fromEntries(assignment.demands)).toEqual({
      dialog: ['badge'],
      home: ['badge'],
      orders: ['badge'],
    });
    expect(findUncoveredMessages(APP, assignment)).toEqual([]);
  });

  it('keeps what the entries demand in files of their own with pinEntries', () => {
    const assignment = assignTranslationsByRegion(APP, {
      ...exact(APP),
      requestCost: HUGE,
      pinEntries: true,
    });
    expect(Object.fromEntries(assignment.files)).toEqual({
      badge: [
        'badge',
        'cell',
        'dialog',
        'extra',
        'home',
        'orders',
        'table',
        'term1',
        'term2',
      ],
      nav: ['nav', 'shell', 'title'],
    });
    expect(Object.fromEntries(assignment.entries)).toEqual({ main: ['nav'] });
    expect(findUncoveredMessages(APP, assignment)).toEqual([]);
  });

  it.each([
    [
      'small',
      50,
      { own: ['own', 'route'], shared: ['shared'], other: ['other'] },
      [],
    ],
    [
      'large',
      2000,
      { own: ['own'], shared: ['shared'], route: ['route'], other: ['other'] },
      ['own'],
    ],
  ])(
    'merges what one load alone demands into a file that load holds, when that is %s',
    (_name, bytes, files, dialogFiles) => {
      // Two routes share a module, and the dialog of one imports it too
      const graph: RegionGraph = {
        entries: ['main'],
        modules: [
          module('main', [], { dynamicImports: ['route', 'other'] }),
          module('route', ['route'], {
            imports: ['shared'],
            dynamicImports: ['dialog'],
          }),
          module('other', ['other'], { imports: ['shared'] }),
          module('shared', ['shared']),
          module('dialog', ['own'], { imports: ['shared'] }),
        ],
      };
      const assignment = assignTranslationsByRegion(graph, {
        sizes: new Map([
          ['route', 5000],
          ['other', 5000],
          ['shared', 100],
          ['own', bytes],
        ]),
        requestCost: 1000,
        estimateSize: linear,
      });
      // In the file of the route that opens it the dialog saves its request
      // of 1,000, and only that route downloads its bytes: in the shared
      // file the other route would too
      expect(Object.fromEntries(assignment.files)).toEqual(files);
      expect(assignment.getImportedFiles('route', 'dialog')).toEqual(
        dialogFiles
      );
      expect(findUncoveredMessages(graph, assignment)).toEqual([]);
    }
  );

  it('never merges what two loads each demand alone', () => {
    const graph: RegionGraph = {
      entries: ['main'],
      modules: [
        module('main', [], { dynamicImports: ['route'] }),
        module('route', [], { dynamicImports: ['first', 'second'] }),
        module('first', ['first']),
        module('second', ['second']),
      ],
    };
    const assignment = assignTranslationsByRegion(graph, {
      ...exact(graph),
      requestCost: HUGE,
    });
    expect(Object.fromEntries(assignment.files)).toEqual({
      first: ['first'],
      second: ['second'],
    });
  });

  it('lists the regions with the loads that pay for them', () => {
    expect(listRegions(APP)).toEqual([
      { hashes: ['badge', 'cell', 'table'], loads: ['home', 'orders'] },
      { hashes: ['dialog', 'extra'], loads: ['dialog'] },
      { hashes: ['home'], loads: ['home'] },
      // The entry's alone, though a route and the dialog demand some of it
      { hashes: ['nav', 'shell', 'title'], loads: ['main'] },
      { hashes: ['orders', 'term1', 'term2'], loads: ['orders'] },
    ]);
  });

  it.each([
    ['a few routes share and that is small', 100, 1, ['shared', 'shell']],
    ['a few routes share and that is large', 5000, 1, ['shell']],
    [
      'the routes with most of the traffic share',
      5000,
      30,
      ['route0', 'route1', 'shared', 'shell'],
    ],
  ])(
    'weighs a merge into the entry by every page: what %s',
    (_name, bytes, weight, entryFile) => {
      const routes = Array.from({ length: 10 }, (_, index) => `route${index}`);
      const graph: RegionGraph = {
        entries: ['main'],
        modules: [
          module('main', ['shell'], { dynamicImports: routes }),
          ...routes.map((id, index) =>
            module(id, [id], { imports: index < 2 ? ['shared'] : [] })
          ),
          module('shared', ['shared']),
        ],
      };
      const assignment = assignTranslationsByRegion(graph, {
        sizes: new Map([...sizesOf(graph), ['shared', bytes]]),
        requestCost: 1000,
        estimateSize: linear,
        weights: new Map([
          ['route0', weight],
          ['route1', weight],
        ]),
      });
      const [key] = assignment.entries.get('main')!;
      expect(assignment.files.get(key)).toEqual(entryFile);
      expect(findUncoveredMessages(graph, assignment)).toEqual([]);
    }
  );

  describe('in an app whose entry imports the root, which names the routes', () => {
    // 40 routes, each with a dialog and five of the 20 modules of a pool.
    // The entry and every route import the theme.
    const routes = Array.from({ length: 40 }, (_, index) => `route${index}`);
    const createApp = (root: RootImport): RegionGraph => ({
      entries: ['main'],
      modules: [
        module('main', ['setup'], {
          imports: root === 'static' ? ['theme', 'root'] : ['theme'],
          dynamicImports: root === 'static' ? [] : ['root'],
        }),
        module('root', ['nav'], { imports: ['table'] }),
        module('table', [], { dynamicImports: routes }),
        module('theme', ['theme']),
        ...routes.flatMap((id, index) => [
          module(id, [id], {
            imports: [
              'theme',
              ...[0, 1, 2, 3, 4].map((at) => `pool${(index + at) % 20}`),
            ],
            dynamicImports: [`dialog${index}`],
          }),
          module(`dialog${index}`, [`dialog${index}`], {
            imports: [`pool${index % 20}`],
          }),
        ]),
        ...Array.from({ length: 20 }, (_, index) =>
          module(`pool${index}`, [`pool${index}`])
        ),
      ],
    });
    const sizes = (graph: RegionGraph) =>
      new Map(
        [...sizesOf(graph, 3000)].map(([hash, bytes]) => [
          hash,
          hash.startsWith('pool') ? 20_000 : bytes,
        ])
      );

    it.each(['dynamic', 'static'] as const)(
      'keeps the startup file to what every page demands, with a %s import of the root',
      (root) => {
        const graph = createApp(root);
        const assignment = assignTranslationsByRegion(graph, {
          sizes: sizes(graph),
          estimateSize: linear,
        });
        // Whichever way the root is imported: a route pays for one module of
        // the pool in four, and 81 loads would download it with the entry
        expect(
          assignment.entries
            .get('main')!
            .map((key) => assignment.files.get(key))
        ).toEqual([['nav', 'setup', 'theme']]);
        expect(assignment.stats).toMatchObject({
          startupMessages: 3,
          startupBytes: 9000,
          entryMessages: root === 'static' ? 3 : 2,
          entryBytes: root === 'static' ? 9000 : 6000,
        });
        // A route requests its own file and those of its five pool modules
        expect(assignment.imports.get('route7')).toHaveLength(6);
        expect(assignment.files.size).toBe(61);
        expectPartition(graph, assignment);
        expect(findUncoveredMessages(graph, assignment)).toEqual([]);
      }
    );
  });

  describe('in a chain of loads, each imported by the one before', () => {
    // The entry imports the root, the root a layout and the layout ten
    // pages, which import its frame. The first page opens a dialog.
    const pages = Array.from({ length: 10 }, (_, index) => `page${index}`);
    const graph: RegionGraph = {
      entries: ['main'],
      modules: [
        module('main', ['setup'], { dynamicImports: ['root'] }),
        module('root', [], { imports: ['nav'], dynamicImports: ['layout'] }),
        module('nav', ['nav']),
        module('layout', [], { imports: ['frame'], dynamicImports: pages }),
        module('frame', ['frame']),
        ...pages.map((id, index) =>
          module(id, [id], {
            imports: index < 2 ? ['frame', 'shared'] : ['frame'],
            dynamicImports: index ? [] : ['dialog'],
          })
        ),
        module('shared', ['shared']),
        module('dialog', ['dialog'], { imports: ['nav', 'frame'] }),
      ],
    };

    it('counts a message for the first load that demands it, and for none that can only run after that one', () => {
      expect(listRegions(graph)).toEqual([
        { hashes: ['dialog'], loads: ['dialog'] },
        // Not the pages and the dialog, which only run after the layout
        { hashes: ['frame'], loads: ['layout'] },
        // Not the dialog, three imports further on
        { hashes: ['nav'], loads: ['root'] },
        ...pages.map((id) => ({ hashes: [id], loads: [id] })),
        { hashes: ['setup'], loads: ['main'] },
        { hashes: ['shared'], loads: ['page0', 'page1'] },
      ]);
    });

    it.each([
      ['two pages share and that is small', 50, 1, ['shared']],
      ['two pages share and that is large', 5000, 1, []],
      [
        'the pages with most of the traffic share',
        5000,
        30,
        ['page0', 'page1', 'shared'],
      ],
    ])(
      'weighs a merge into the file of a load by every load that can only run after it: what %s',
      (_name, bytes, weight, merged) => {
        const assignment = assignTranslationsByRegion(graph, {
          sizes: new Map([...sizesOf(graph, 200), ['shared', bytes]]),
          requestCost: 1000,
          estimateSize: linear,
          weights: new Map([
            ['page0', weight],
            ['page1', weight],
          ]),
        });
        // The layout's frame is in the startup file, which 14 loads
        // download: what two pages share joins it only when their requests
        // outweigh its bytes for the other loads
        expect(
          assignment.entries
            .get('main')!
            .map((key) => assignment.files.get(key))
        ).toEqual([['frame', 'nav', 'setup', ...merged].sort()]);
        expect(findUncoveredMessages(graph, assignment)).toEqual([]);
      }
    );

    it('lists for an import the files its load demands, without the entry’s and the importing load’s', () => {
      const assignment = assignTranslationsByRegion(graph, exact(graph));
      expect(Object.fromEntries(assignment.demands)).toEqual({
        dialog: ['dialog', 'frame', 'nav'],
        layout: ['frame'],
        ...Object.fromEntries(
          pages.map((id, index) => [
            id,
            index < 2 ? ['frame', id, 'shared'] : ['frame', id],
          ])
        ),
        root: ['nav'],
      });
      expect(assignment.getImportedFiles('main', 'root')).toEqual(['nav']);
      expect(assignment.getImportedFiles('root', 'layout')).toEqual(['frame']);
      expect(assignment.getImportedFiles('layout', 'page0')).toEqual([
        'page0',
        'shared',
      ]);
      // The root's file is held by then too. The list of an import site
      // leaves out only what its own load and the entry demand; the build
      // ships `demands`, and gt-react skips every file a page holds
      expect(assignment.getImportedFiles('page0', 'dialog')).toEqual([
        'dialog',
        'nav',
      ]);
      expect(findUncoveredMessages(graph, assignment)).toEqual([]);
    });
  });

  it('handles a load point that another imports statically, and one without messages', () => {
    const graph: RegionGraph = {
      entries: ['main'],
      modules: [
        module('main', [], { dynamicImports: ['audit', 'orders', 'blank'] }),
        module('orders', ['orders'], { dynamicImports: ['dialog'] }),
        module('audit', ['audit'], { imports: ['dialog'] }),
        module('dialog', ['dialog']),
        module('blank', [], { imports: ['external'] }),
      ],
    };
    const assignment = assignTranslationsByRegion(graph, exact(graph));
    expect(plain(assignment)).toEqual({
      entries: [['main', []]],
      files: [
        ['audit', ['audit']],
        ['dialog', ['dialog']],
        ['orders', ['orders']],
      ],
      imports: [
        ['audit', ['audit', 'dialog']],
        ['blank', []],
        ['dialog', ['dialog']],
        ['orders', ['orders']],
      ],
    });
    expect(findUncoveredMessages(graph, assignment)).toEqual([]);
  });

  it('keeps what only some pages hold when a build has several entries', () => {
    const graph: RegionGraph = {
      entries: ['a', 'b'],
      modules: [
        module('a', ['a', 'both'], { dynamicImports: ['lazy'] }),
        module('b', ['b', 'both'], { dynamicImports: ['lazy'] }),
        module('lazy', ['lazy', 'a']),
      ],
    };
    const assignment = assignTranslationsByRegion(graph, exact(graph));
    expect(plain(assignment)).toEqual({
      entries: [
        ['a', ['a', 'both']],
        ['b', ['b', 'both']],
      ],
      files: [
        ['a', ['a']],
        ['b', ['b']],
        ['both', ['both']],
        ['lazy', ['lazy']],
      ],
      imports: [['lazy', ['a', 'lazy']]],
    });
    expect(assignment.getImportedFiles('a', 'lazy')).toEqual(['lazy']);
    expect(assignment.getImportedFiles('b', 'lazy')).toEqual(['a', 'lazy']);
    expect(findUncoveredMessages(graph, assignment)).toEqual([]);
  });

  it('gives a message of a module no load point reaches to every entry', () => {
    const graph: RegionGraph = {
      entries: ['main'],
      modules: [module('main', ['main']), module('stray', ['stray'])],
    };
    const assignment = assignTranslationsByRegion(graph, exact(graph));
    expect(plain(assignment)).toEqual({
      entries: [['main', ['main']]],
      files: [['main', ['main', 'stray']]],
      imports: [],
    });
  });

  describe('with modules that are initialised with their chunk', () => {
    // The chunk of `used` also holds `other`, which registers a message
    // when it is initialised
    const modules = [
      module('main', ['main'], { dynamicImports: ['first', 'second'] }),
      module('first', ['first'], { imports: ['used'] }),
      module('second', ['second'], { imports: ['other'] }),
      module('used', ['used']),
      module('other', ['other'], { initialHashes: ['registered'] }),
    ];
    const lazy: RegionGraph = { entries: ['main'], modules };
    const eager: RegionGraph = {
      ...lazy,
      evaluated: new Map([
        ['first', ['first', 'used', 'other']],
        ['second', ['second', 'other', 'used']],
      ]),
    };

    it('demands only what a load reaches when modules are initialised lazily', () => {
      const assignment = assignTranslationsByRegion(lazy, exact(lazy));
      expect(Object.fromEntries(assignment.files)).toEqual({
        first: ['first', 'used'],
        main: ['main'],
        other: ['other', 'registered', 'second'],
      });
      expect(findUncoveredMessages(lazy, assignment)).toEqual([]);
      expect(assignment.stats).toMatchObject({
        isConservative: false,
        conservativeMessages: 0,
      });
      // The same files leave the first route without the registered message
      expect(findUncoveredMessages(eager, assignment)).toEqual([
        { load: 'first', hash: 'registered' },
        { load: 'first', importer: 'main', hash: 'registered' },
      ]);
    });

    it('also demands what the modules of its chunks run when they are initialised', () => {
      const assignment = assignTranslationsByRegion(eager, exact(eager));
      expect(Object.fromEntries(assignment.files)).toEqual({
        first: ['first', 'used'],
        main: ['main'],
        other: ['other', 'second'],
        register: ['registered'],
      });
      expect(Object.fromEntries(assignment.imports)).toEqual({
        first: ['first', 'register'],
        second: ['other', 'register'],
      });
      expect(findUncoveredMessages(eager, assignment)).toEqual([]);
      // One message is demanded by a load that does not reach its module
      expect(assignment.stats).toMatchObject({
        isConservative: true,
        conservativeMessages: 1,
      });
    });
  });

  it('gives the same files whatever the order of the modules and their messages', () => {
    const random = createRandom(5);
    const shuffle = <Item>(items: readonly Item[]) =>
      items
        .map((item) => [random(), item] as const)
        .sort(([a], [b]) => a - b)
        .map(([, item]) => item);
    const app = createSyntheticApp({ messages: 3000 });
    const shuffled: RegionGraph = {
      entries: app.graph.entries,
      modules: shuffle(app.graph.modules).map((item) => ({
        ...item,
        hashes: shuffle(item.hashes),
        imports: shuffle(item.imports),
        dynamicImports: shuffle(item.dynamicImports),
      })),
    };
    const first = assignTranslationsByRegion(app.graph, { sizes: app.sizes });
    expect(
      plain(assignTranslationsByRegion(app.graph, { sizes: app.sizes }))
    ).toEqual(plain(first));
    expect(
      plain(assignTranslationsByRegion(shuffled, { sizes: app.sizes }))
    ).toEqual(plain(first));
  });

  describe('findUncoveredMessages', () => {
    const assignment = assignTranslationsByRegion(APP, exact(APP));

    it('reports what a load demands from a file its list leaves out', () => {
      expect(
        findUncoveredMessages(APP, {
          ...assignment,
          imports: new Map([...assignment.imports, ['home', ['home']]]),
        })
      ).toEqual([
        { load: 'home', hash: 'badge' },
        { load: 'home', hash: 'table' },
        { load: 'home', hash: 'cell' },
      ]);
    });

    it('reports a message that is in no file, and an import that lists too little', () => {
      const files = new Map(assignment.files);
      files.set('dialog', ['dialog']);
      expect(
        findUncoveredMessages(APP, {
          ...assignment,
          files,
          getImportedFiles: () => [],
        })
      ).toEqual([
        { load: 'dialog', hash: 'extra' },
        { load: 'home', importer: 'main', hash: 'home' },
        { load: 'home', importer: 'main', hash: 'badge' },
        { load: 'home', importer: 'main', hash: 'table' },
        { load: 'home', importer: 'main', hash: 'cell' },
        { load: 'orders', importer: 'main', hash: 'orders' },
        { load: 'orders', importer: 'main', hash: 'badge' },
        { load: 'orders', importer: 'main', hash: 'table' },
        { load: 'orders', importer: 'main', hash: 'term1' },
        { load: 'orders', importer: 'main', hash: 'term2' },
        { load: 'orders', importer: 'main', hash: 'cell' },
        { load: 'dialog', importer: 'orders', hash: 'dialog' },
      ]);
    });
  });

  describe('with the files of the previous build', () => {
    const options = (app: SyntheticApp): RegionOptions => ({
      sizes: app.sizes,
    });

    it('returns them unchanged when nothing changed, under their keys', () => {
      const app = createSyntheticApp({ messages: 3000 });
      const first = assignTranslationsByRegion(app.graph, options(app));
      const renamed = new Map(
        [...first.files].map(([key, hashes]) => [`file-${key}`, hashes])
      );
      const second = assignTranslationsByRegion(app.graph, {
        ...options(app),
        previous: getPrevious(renamed),
      });
      expect([...second.files]).toEqual(
        [...renamed].sort(([a], [b]) => (a < b ? -1 : 1))
      );
      expect(second.stats.regions).toBe(first.stats.regions);
    });

    it('names a new file so that no key is used twice', () => {
      const graph: RegionGraph = {
        entries: ['main'],
        modules: [
          module('main', ['11112222aaaa'], { dynamicImports: ['route'] }),
          module('route', ['11112222bbbb']),
        ],
      };
      const assignment = assignTranslationsByRegion(graph, {
        ...exact(graph),
        previous: new Map([['11112222aaaa', '11112222']]),
      });
      expect(Object.fromEntries(assignment.files)).toEqual({
        '11112222': ['11112222aaaa'],
        '11112222b': ['11112222bbbb'],
      });
    });

    it('keeps a message in its file while they still merge, where a build from nothing moves it', () => {
      // `x` merges with `y` or with `z`, whichever is smaller, and not both
      const graph = (y: string[]): RegionGraph => ({
        entries: ['main'],
        modules: [
          module('main', [], { dynamicImports: ['r1', 'r2', 'r3', 'r4'] }),
          module('r1', [], { imports: ['x', 'y'] }),
          module('r2', [], { imports: ['x', 'z'] }),
          module('r3', [], { imports: ['y'] }),
          module('r4', [], { imports: ['z'] }),
          module('x', ['x']),
          module('y', y),
          module('z', ['z']),
        ],
      });
      const options: RegionOptions = {
        sizes: new Map([
          ['x', 40],
          ['y', 50],
          ['y2', 10],
          ['z', 55],
        ]),
        requestCost: 150,
        estimateSize: linear,
      };
      const before = assignTranslationsByRegion(graph(['y']), options);
      expect(Object.fromEntries(before.files)).toEqual({
        x: ['x', 'y'],
        z: ['z'],
      });
      // With one more message `y` is the larger of the two
      const changed = graph(['y', 'y2']);
      expect(
        Object.fromEntries(assignTranslationsByRegion(changed, options).files)
      ).toEqual({ x: ['x', 'z'], y: ['y', 'y2'] });
      const after = assignTranslationsByRegion(changed, {
        ...options,
        previous: getPrevious(before.files),
      });
      expect(Object.fromEntries(after.files)).toEqual({
        x: ['x', 'y', 'y2'],
        z: ['z'],
      });
      expect(findUncoveredMessages(changed, after)).toEqual([]);
    });

    it.each([
      ['one more import', addImport],
      ['one more message', addMessage],
    ])(
      'moves fewer bytes after %s than a build from nothing',
      (_name, change) => {
        const app = createSyntheticApp({ messages: 6000 });
        const before = assignTranslationsByRegion(app.graph, options(app));
        const changed = change(app);
        const scratch = assignTranslationsByRegion(
          changed.graph,
          options(changed)
        );
        const stable = assignTranslationsByRegion(changed.graph, {
          ...options(changed),
          previous: getPrevious(before.files),
        });
        expect(findUncoveredMessages(changed.graph, stable)).toEqual([]);
        expectPartition(changed.graph, stable);
        const fromScratch = compareFiles(
          before.files,
          scratch.files,
          changed.sizes
        );
        const fromPrevious = compareFiles(
          before.files,
          stable.files,
          changed.sizes
        );
        expect(fromPrevious.changedFiles).toBeLessThanOrEqual(
          fromScratch.changedFiles
        );
        expect(fromPrevious.moved).toBeLessThanOrEqual(fromScratch.moved);
        expect(fromPrevious.moved / fromPrevious.total).toBeLessThan(0.01);
      }
    );

    it('adds a new message to the file of the messages next to it', () => {
      const app = createSyntheticApp({ messages: 6000 });
      const before = assignTranslationsByRegion(app.graph, options(app));
      const changed = addMessage(app);
      const after = assignTranslationsByRegion(changed.graph, {
        ...options(changed),
        previous: getPrevious(before.files),
      });
      const neighbour = changed.graph.modules.find((item) =>
        item.hashes.includes(ADDED_MESSAGE)
      )!.hashes[0];
      const key = getPrevious(before.files).get(neighbour)!;
      expect(getPrevious(after.files).get(ADDED_MESSAGE)).toBe(key);
      expect(compareFiles(before.files, after.files, changed.sizes)).toEqual({
        total: [...changed.sizes.values()].reduce((sum, bytes) => sum + bytes),
        changedFiles: after.files
          .get(key)!
          .reduce((sum, hash) => sum + changed.sizes.get(hash)!, 0),
        moved: 0,
      });
    });
  });

  it('splits an app of 12,000 messages without comparing every pair of regions twice', () => {
    const app = createSyntheticApp({ messages: 12_000 });
    const assignment = assignTranslationsByRegion(app.graph, {
      sizes: app.sizes,
    });
    expectPartition(app.graph, assignment);
    expect(findUncoveredMessages(app.graph, assignment)).toEqual([]);
    const { regions, comparisons } = assignment.stats;
    expect(regions).toBeGreaterThan(900);
    expect(assignment.files.size).toBeLessThan(regions / 2);
    expect(comparisons).toBeLessThan(regions * regions);
  });

  // What an average route downloads of the entry's file without demanding
  // it, at the default cost of a request, in an app of 12,000 messages. The
  // bounds are a quarter above what the rule gives today, whichever way the
  // entry imports the root: 20.7 kB on the shape of the measured app and
  // 24.9 kB on the stress shape.
  it.each([
    ['the measured app', createSyntheticApp, 26],
    [
      'an app whose loads repeat single messages of each other',
      createStressApp,
      31,
    ],
  ])(
    'keeps the waste in the entry file under a bound on the shape of %s, whichever way the entry imports the root',
    (_name, create, bound) => {
      const [dynamic, fixed] = (['dynamic', 'static'] as const).map((root) => {
        const app = create({ messages: 12_000, root });
        const assignment = assignTranslationsByRegion(app.graph, {
          sizes: app.sizes,
        });
        expectPartition(app.graph, assignment);
        expect(findUncoveredMessages(app.graph, assignment)).toEqual([]);
        const waste = getEntryWaste(
          app,
          listRegions(app.graph),
          getRegionSplit(app, assignment),
          estimateCompressedSize
        );
        expect(waste / 1024).toBeLessThan(bound);
        // The counts of the result are those of its files
        const startup = describeStartup(
          app,
          assignment,
          estimateCompressedSize
        );
        expect(assignment.stats).toMatchObject({
          startupMessages: startup.messages,
          entryMessages: startup.demanded,
        });
        return assignment.stats;
      });
      // With a dynamic import the entry demands no more, and its file holds
      // what the root demands all the same
      expect(dynamic.entryMessages).toBeLessThanOrEqual(fixed.entryMessages);
      expect(dynamic.startupMessages / fixed.startupMessages).toBeCloseTo(1, 1);
    }
  );

  it('has a stress shape in which about half the regions are paid for by two loads', () => {
    const regions = listRegions(createStressApp({ messages: 12_000 }).graph);
    const counts = countRegionsByLoads(regions);
    expect(counts['2'] / regions.length).toBeGreaterThan(0.45);
    expect(counts['over 20'] / regions.length).toBeLessThan(0.05);
  });

  describe('against the rule as it is written', () => {
    /**
     * The files of a graph, with nothing of the function: a page that gets as
     * far as a load has run that load and every load it cannot run without,
     * and downloads each file with a message one of them demands. Every load
     * is where a page gets to equally often. The two files merge first whose
     * merge saves the most bytes, at `requestCost` bytes a request.
     */
    function assignNaively(
      graph: RegionGraph,
      sizes: ReadonlyMap<string, number>,
      requestCost: number,
      estimateSize: (bytes: number) => number
    ): string[][] {
      const byId = new Map(graph.modules.map((item) => [item.id, item]));
      const follow = (
        starts: Iterable<string>,
        next: (id: string) => string[]
      ) => {
        const reached = new Set(starts);
        for (const id of reached) for (const to of next(id)) reached.add(to);
        return reached;
      };
      const loads = [
        ...new Set([
          ...graph.entries,
          ...graph.modules.flatMap((item) => item.dynamicImports),
        ]),
      ].sort();
      const modulesOf = new Map(
        loads.map((load) => [
          load,
          follow([load], (id) => [...byId.get(id)!.imports]),
        ])
      );
      const importedBy = (load: string) =>
        [...modulesOf.get(load)!].flatMap((id) => byId.get(id)!.dynamicImports);
      const led = follow(graph.entries, importedBy);
      // A load no entry leads to starts a page of its own
      const starts = loads.filter(
        (load) => graph.entries.includes(load) || !led.has(load)
      );
      /** Whether a page can get to `load` without running `other`. */
      const runsWithout = (load: string, other: string) =>
        follow(
          starts.filter((start) => start !== other),
          (id) => importedBy(id).filter((to) => to !== other)
        ).has(load);
      const running = new Map(
        loads.map((load) => [
          load,
          loads.filter((other) => other === load || !runsWithout(load, other)),
        ])
      );

      const demanding = new Map<string, Set<string>>();
      for (const load of loads) {
        for (const id of modulesOf.get(load)!) {
          for (const hash of byId.get(id)!.hashes) {
            if (!demanding.has(hash)) demanding.set(hash, new Set());
            demanding.get(hash)!.add(load);
          }
        }
      }
      type File = { hashes: string[]; pages: Set<string>; bytes: number };
      const regions = new Map<string, File>();
      for (const hash of [
        ...new Set(graph.modules.flatMap((item) => item.hashes)),
      ].sort()) {
        const demand = demanding.get(hash) ?? new Set(graph.entries);
        const pages = loads.filter((load) =>
          running.get(load)!.some((ran) => demand.has(ran))
        );
        const key = pages.join();
        if (!regions.has(key)) {
          regions.set(key, { hashes: [], pages: new Set(pages), bytes: 0 });
        }
        regions.get(key)!.hashes.push(hash);
        regions.get(key)!.bytes += sizes.get(hash)!;
      }
      const files = [...regions.values()];
      for (;;) {
        let best = 0;
        let pair: [number, number] | undefined;
        for (let a = 0; a < files.length; a++) {
          for (let b = a + 1; b < files.length; b++) {
            const [x, y] = [files[a], files[b]];
            const shared = [...x.pages].filter((page) =>
              y.pages.has(page)
            ).length;
            const gain =
              x.pages.size * estimateSize(x.bytes) +
              y.pages.size * estimateSize(y.bytes) +
              requestCost * shared -
              (x.pages.size + y.pages.size - shared) *
                estimateSize(x.bytes + y.bytes);
            if (gain > best) {
              best = gain;
              pair = [a, b];
            }
          }
        }
        if (!pair) break;
        const [x, y] = [files[pair[0]], files[pair[1]]];
        x.hashes.push(...y.hashes);
        for (const page of y.pages) x.pages.add(page);
        x.bytes += y.bytes;
        files.splice(pair[1], 1);
      }
      return files.map((file) => file.hashes.sort()).sort();
    }

    /** Modules that import each other at random, also in cycles. */
    function createGraph(seed: number) {
      const random = createRandom(seed);
      const pick = (count: number) => Math.floor(random() * count);
      const ids = Array.from(
        { length: 6 + pick(14) },
        (_, index) => `m${String(index).padStart(2, '0')}`
      );
      const some = (most: number) =>
        Array.from({ length: pick(most + 1) }, () => ids[pick(ids.length)]);
      const graph: RegionGraph = {
        entries: random() < 0.3 ? [ids[0], ids[1]] : [ids[0]],
        modules: ids.map((id) =>
          module(
            id,
            [
              ...new Set(
                Array.from(
                  { length: pick(4) },
                  () => `h${String(pick(ids.length * 2)).padStart(2, '0')}`
                )
              ),
            ],
            { imports: some(2), dynamicImports: some(2) }
          )
        ),
      };
      const sizes = new Map(
        graph.modules
          .flatMap((item) => item.hashes)
          .sort()
          .map((hash) => [hash, 20 + pick(3000)])
      );
      return { graph, sizes };
    }

    it('gives the files that trying every pair gives, on 90 graphs', () => {
      for (let seed = 0; seed < 90; seed++) {
        const { graph, sizes } = createGraph(seed);
        const requestCost = [0, 200, 2000][seed % 3];
        const estimateSize = seed % 2 ? estimateCompressedSize : linear;
        const assignment = assignTranslationsByRegion(graph, {
          sizes,
          requestCost,
          estimateSize,
        });
        expect([seed, ...assignment.files.values()]).toEqual([
          seed,
          ...assignNaively(graph, sizes, requestCost, estimateSize),
        ]);
        expect(findUncoveredMessages(graph, assignment)).toEqual([]);
      }
    });
  });

  it('takes a load that two loads import to run only after what both run after', () => {
    // `b` can only run after `a`, which it imports back; `d` runs after `b`
    // or after `c`
    const graph: RegionGraph = {
      entries: ['main'],
      modules: [
        module('main', ['main'], { dynamicImports: ['a', 'c'] }),
        module('a', ['a'], { dynamicImports: ['b'] }),
        module('b', ['b', 'a'], { imports: ['x'], dynamicImports: ['a', 'd'] }),
        module('c', ['c'], { imports: ['x'], dynamicImports: ['d'] }),
        module('d', ['d', 'a', 'main'], { imports: ['x'] }),
        module('x', ['x']),
      ],
    };
    expect(listRegions(graph)).toEqual([
      { hashes: ['a'], loads: ['a', 'd'] },
      { hashes: ['b'], loads: ['b'] },
      { hashes: ['c'], loads: ['c'] },
      { hashes: ['d'], loads: ['d'] },
      { hashes: ['main'], loads: ['main'] },
      { hashes: ['x'], loads: ['b', 'c', 'd'] },
    ]);
    expect(
      findUncoveredMessages(
        graph,
        assignTranslationsByRegion(graph, exact(graph))
      )
    ).toEqual([]);
  });
});

describe('mergeRegions', () => {
  /** Best pair first over every pair of blocks, as the rule is written. */
  function mergeNaively(input: RegionMergeInput): Int32Array {
    const count = input.bytes.length;
    const read = (rows: Uint32Array | undefined, index: number) =>
      new Set(
        Array.from(input.weights.keys()).filter(
          (load) =>
            rows &&
            (rows[index * input.words + (load >>> 5)] >>> (load & 31)) & 1
        )
      );
    const blocks = Array.from({ length: count }, (_, index) => ({
      first: index,
      regions: [index],
      loads: read(input.loads, index),
      holders: read(input.holders, index),
      bytes: input.bytes[index],
    }));
    const weigh = (loads: Iterable<number>) => {
      let weight = 0;
      for (const load of loads) weight += input.weights[load];
      return weight;
    };
    for (;;) {
      let best = 0;
      let pair: [number, number] | undefined;
      for (let a = 0; a < blocks.length; a++) {
        for (let b = a + 1; b < blocks.length; b++) {
          const [x, y] = [blocks[a], blocks[b]];
          if (input.classes[x.first] !== input.classes[y.first]) continue;
          // The loads that pay for one block less, and those that pay for
          // one and hold the other
          const shared =
            weigh([...x.loads].filter((load) => y.loads.has(load))) +
            weigh([...x.loads].filter((load) => y.holders.has(load))) +
            weigh([...y.loads].filter((load) => x.holders.has(load)));
          const weightX = weigh(x.loads);
          const weightY = weigh(y.loads);
          const gain =
            weightX * input.estimateSize(x.bytes) +
            weightY * input.estimateSize(y.bytes) +
            input.requestCost * shared -
            (weightX + weightY - shared) *
              input.estimateSize(x.bytes + y.bytes);
          if (gain > best) {
            best = gain;
            pair = [a, b];
          }
        }
      }
      if (!pair) break;
      const [x, y] = [blocks[pair[0]], blocks[pair[1]]];
      x.regions.push(...y.regions);
      for (const load of y.loads) x.loads.add(load);
      for (const load of y.holders) x.holders.add(load);
      for (const load of x.holders) x.loads.delete(load);
      x.bytes += y.bytes;
      blocks.splice(pair[1], 1);
    }
    const result = new Int32Array(count);
    for (const block of blocks) {
      for (const region of block.regions) result[region] = block.first;
    }
    return result;
  }

  function createInput(seed: number, weighted: boolean): RegionMergeInput {
    const random = createRandom(seed);
    const count = 8 + Math.floor(random() * 30);
    const loadCount = 3 + Math.floor(random() * 60);
    const words = Math.ceil(loadCount / 32);
    const loads = new Uint32Array(count * words);
    // Half of the inputs have loads that hold a region without paying for it
    const holders = new Uint32Array(count * words);
    const density = 0.05 + random() * 0.5;
    const held = seed % 4 < 2 ? 0 : 0.02 + random() * 0.1;
    for (let region = 0; region < count; region++) {
      for (let load = 0; load < loadCount; load++) {
        const at = region * words + (load >>> 5);
        if (random() < density) loads[at] |= 1 << (load & 31);
        else if (random() < held) holders[at] |= 1 << (load & 31);
      }
    }
    return {
      loads,
      words,
      holders,
      weights: Float64Array.from({ length: loadCount }, () =>
        weighted ? 1 + Math.floor(random() * 5) : 1
      ),
      bytes: Float64Array.from({ length: count }, () =>
        Math.floor(random() * random() * 4000)
      ),
      classes: Int32Array.from({ length: count }, () =>
        random() < 0.1 ? 1 : 0
      ),
      requestCost: [0, 200, 2000][seed % 3],
      estimateSize: seed % 2 ? estimateCompressedSize : linear,
    };
  }
  const seeds = Array.from({ length: 60 }, (_, seed) => seed);

  it.each([
    ['one weight for every load', false],
    ['a weight per load', true],
  ])('merges the best pair first, with %s', (_name, weighted) => {
    for (const seed of seeds) {
      const input = createInput(seed, weighted);
      expect([seed, ...mergeRegions(input).blocks]).toEqual([
        seed,
        ...mergeNaively(input),
      ]);
    }
  });

  it('puts the blocks it returned together again when they are its groups', () => {
    for (const seed of seeds) {
      const input = createInput(seed, seed % 4 === 0);
      const { blocks } = mergeRegions(input);
      expect([
        seed,
        ...mergeRegions({ ...input, groups: blocks }).blocks,
      ]).toEqual([seed, ...blocks]);
    }
  });

  it('merges inside a group before it merges anything else', () => {
    // The first region gains 50 by merging with the second and 55 with the
    // third, and nothing merges with both
    const input: RegionMergeInput = {
      loads: Uint32Array.of(0b0011, 0b0101, 0b1010),
      words: 1,
      weights: Float64Array.of(1, 1, 1, 1),
      bytes: Float64Array.of(40, 60, 55),
      classes: Int32Array.of(0, 0, 0),
      requestCost: 150,
      estimateSize: linear,
    };
    expect([...mergeRegions(input).blocks]).toEqual([0, 1, 0]);
    expect([
      ...mergeRegions({ ...input, groups: Int32Array.of(5, 5, -1) }).blocks,
    ]).toEqual([0, 0, 2]);
  });
});

describe('estimateCompressedSize', () => {
  it('fits its curve to what files compress to', () => {
    const curve = (bytes: number) => 10 + 2 * bytes ** 0.8;
    const estimate = fitCompressedSize(
      [100, 300, 1000, 3000, 10_000, 30_000].map((bytes) => ({
        bytes,
        compressed: curve(bytes),
      }))
    );
    expect(estimate(500) / curve(500)).toBeCloseTo(1, 2);
    expect(estimate(20_000) / curve(20_000)).toBeCloseTo(1, 2);
    // Past gzip's window a file grows by a steady share of its bytes
    expect(estimate(200_000) - estimate(100_000)).toBeCloseTo(
      estimate(300_000) - estimate(200_000),
      6
    );
  });

  it('keeps the default curve when there are too few files to fit', () => {
    expect(fitCompressedSize([{ bytes: 100, compressed: 80 }])).toBe(
      estimateCompressedSize
    );
  });
});

describe('createRegionGraph', () => {
  const [A, B, C, D, E, DEAD] = ['a', 'b', 'c', 'd', 'e', 'f'].map((digit) =>
    digit.repeat(16)
  );
  const hashes = new Set([A, B, C, D, E, DEAD]);
  // The entry names a route in a dynamic import. The route imports a module
  // that only re-exports a widget, of which the bundler left no code; the
  // widget shares a chunk with a module the route does not reach.
  const chunks: RegionChunk[] = [
    {
      fileName: 'index.js',
      isEntry: true,
      facadeModuleId: 'index.html',
      imports: ['shared.js'],
      code: `t({$_hash:"${A}"})`,
      modules: {
        'index.html': { code: null },
        'main.js': {
          code: `t({ $_hash: "${A}" });\nunused({ $_hash: "${DEAD}" });`,
        },
      },
    },
    {
      fileName: 'route.js',
      isEntry: false,
      facadeModuleId: 'route.js',
      imports: ['shared.js'],
      code: `t({$_hash:\`${B}\`})`,
      modules: { 'route.js': { code: `t({ $_hash: "${B}" });` } },
    },
    {
      fileName: 'shared.js',
      isEntry: false,
      facadeModuleId: null,
      imports: [],
      // The last hash is in no module's code, as if a plugin had added it
      code: `t({$_hash:'${C}'});r({$_hash:'${D}'});t({$_hash:'${E}'})`,
      modules: {
        'widget.js': { code: `t({ $_hash: "${C}" });` },
        'other.js': { code: `register({ $_hash: "${D}" });` },
      },
    },
  ];
  const imports: Record<string, [string[], string[]]> = {
    'index.html': [['main.js'], []],
    'main.js': [[], ['route.js']],
    'route.js': [['barrel.js'], []],
    'barrel.js': [['widget.js'], []],
  };
  const getModuleInfo = (id: string) =>
    id in imports
      ? { importedIds: imports[id][0], dynamicallyImportedIds: imports[id][1] }
      : null;

  it('reads the modules, their imports and the messages that survive from a bundle', () => {
    expect(
      createRegionGraph(chunks, getModuleInfo, hashes, { isLazy: true })
    ).toEqual({
      graph: {
        entries: ['index.html'],
        modules: [
          module('barrel.js', [], { imports: ['widget.js'] }),
          module('index.html', [], { imports: ['main.js'] }),
          module('main.js', [A], { dynamicImports: ['route.js'] }),
          module('other.js', [D, E]),
          module('route.js', [B], { imports: ['barrel.js'] }),
          module('widget.js', [C, E]),
        ],
      },
      unattributed: 1,
    });
  });

  it('says what a chunk initialises when modules are not initialised lazily', () => {
    const { graph } = createRegionGraph(chunks, getModuleInfo, hashes, {
      isLazy: false,
      initialHashes: new Map([['other.js', [D, DEAD]]]),
    });
    expect(graph.modules.map((item) => [item.id, item.initialHashes])).toEqual([
      ['barrel.js', []],
      ['index.html', []],
      ['main.js', []],
      ['other.js', [D]],
      ['route.js', []],
      ['widget.js', []],
    ]);
    expect([...graph.evaluated!]).toEqual([
      ['index.html', ['other.js']],
      ['route.js', ['other.js']],
    ]);
    // So the route holds the message `other.js` registers, which it does
    // not reach, and not the one a load that reaches the module would
    const assignment = assignTranslationsByRegion(graph, exact(graph));
    expect(findUncoveredMessages(graph, assignment)).toEqual([]);
    const [key] = assignment.entries.get('index.html')!;
    expect(assignment.files.get(key)).toEqual([A, D]);
    expect(assignment.stats.conservativeMessages).toBe(1);
  });

  it('takes every call site to run at initialisation when nothing says which do', () => {
    const { graph } = createRegionGraph(chunks, getModuleInfo, hashes, {
      isLazy: false,
    });
    expect(graph.modules.find((item) => item.id === 'widget.js')).toEqual(
      module('widget.js', [C, E], { initialHashes: [C, E] })
    );
    expect([...graph.evaluated!]).toEqual([
      ['index.html', ['main.js', 'widget.js', 'other.js']],
      ['route.js', ['route.js', 'widget.js', 'other.js']],
    ]);
    // Every message of the shared chunk is then demanded by a load that does
    // not reach its module: the entry's by its chunk alone
    expect(assignTranslationsByRegion(graph, exact(graph)).stats).toMatchObject(
      { isConservative: true, conservativeMessages: 3 }
    );
  });

  it.each([
    [{}, {}, false],
    [{ strictExecutionOrder: true }, {}, true],
    [{ codeSplitting: true }, {}, false],
    [
      { codeSplitting: { experimentalInlineCommonChunks: { maxSize: 4096 } } },
      {},
      true,
    ],
    [
      {
        strictExecutionOrder: false,
        codeSplitting: { experimentalInlineCommonChunks: { maxSize: 4096 } },
      },
      {},
      false,
    ],
    [
      { strictExecutionOrder: true },
      { experimental: { onDemandWrapping: true } },
      false,
    ],
  ])(
    'reads from the options %j and %j whether modules are initialised lazily',
    (output, input, isLazy) => {
      expect(initialisesModulesLazily(output, input)).toBe(isLazy);
    }
  );

  it('weighs a message by its entries in the translations files', () => {
    expect(
      getMessageSizes(
        { fr: { a: 'Bonjour', b: ['x'] }, de: { a: 'Hallo' }, es: undefined },
        ['a', 'b', 'c']
      )
    ).toEqual(
      new Map([
        // "a":"Bonjour", and "a":"Hallo", on average
        ['a', 13],
        ['b', 10],
        ['c', 0],
      ])
    );
  });

  it('compresses files of 1, 2 and 4 messages of a locale to fit an estimate', () => {
    const translations = {
      a: 'One',
      b: 'Two',
      c: 'Three',
      d: null,
      e: 'Five',
      f: 'Six',
    };
    const sizes = new Map([
      ['a', 10],
      ['b', 20],
      ['c', 30],
      ['e', 50],
      ['f', 60],
    ]);
    const compress = (picked: Record<string, string>) =>
      gzipSync(JSON.stringify(picked)).length;
    expect(sampleCompressedSizes(translations, sizes)).toEqual([
      { bytes: 10, compressed: compress({ a: 'One' }) },
      { bytes: 20, compressed: compress({ b: 'Two' }) },
      { bytes: 30, compressed: compress({ c: 'Three' }) },
      { bytes: 50, compressed: compress({ e: 'Five' }) },
      { bytes: 60, compressed: compress({ f: 'Six' }) },
      { bytes: 30, compressed: compress({ a: 'One', b: 'Two' }) },
      { bytes: 110, compressed: compress({ e: 'Five', f: 'Six' }) },
      {
        bytes: 110,
        compressed: compress({ a: 'One', b: 'Two', c: 'Three', e: 'Five' }),
      },
    ]);
  });
});

const kb = (bytes: number) => (bytes / 1024).toFixed(1).padStart(9);

/**
 * Prints what the rule costs and gives on the synthetic app. Not part of the
 * suite: run it with GT_REGION_REPORT=1, and GT_REGION_MESSAGES for a size.
 */
describe.runIf(process.env.GT_REGION_REPORT)('report', () => {
  const messages = Number(process.env.GT_REGION_MESSAGES ?? 65_000);

  /** What each way of splitting costs the routes of an app. */
  const describeQuality = (app: SyntheticApp): string[] => {
    const options: RegionOptions = { sizes: app.sizes };
    const measure = (split: Split) =>
      measureSplit(app, split, estimateCompressedSize);
    const byChunk = assignTranslationsByChunk(app.chunks);
    const assigned = new Map<string, RegionAssignment>();
    const assign = (cost: number, pinEntries = false) => {
      const key = `${cost} ${pinEntries}`;
      if (!assigned.has(key)) {
        assigned.set(
          key,
          assignTranslationsByRegion(app.graph, {
            ...options,
            requestCost: cost * 1024,
            pinEntries,
          })
        );
      }
      return assigned.get(key)!;
    };
    const rows = [
      [
        'whole catalog',
        measure({
          files: new Map([['catalog', [...app.sizes.keys()]]]),
          entry: ['catalog'],
          getRouteFiles: () => [],
        }),
      ],
      [
        'per chunk (assignTranslationsByChunk)',
        measure({
          files: new Map([
            ...byChunk.files,
            ...[...byChunk.entries].map(
              ([file, hashes]) => [`entry ${file}`, hashes] as const
            ),
          ]),
          entry: [
            ...[...byChunk.entries.keys()].map((file) => `entry ${file}`),
            ...app.startup
              .slice(1)
              .flatMap((load) => byChunk.imports.get(app.chunkOf.get(load)!)!),
          ],
          getRouteFiles: (route) =>
            byChunk.imports.get(app.chunkOf.get(route)!)!,
        }),
      ],
      [
        'module-level regions, exact',
        measure(
          getRegionSplit(
            app,
            assignTranslationsByRegion(app.graph, {
              ...options,
              requestCost: 0,
              estimateSize: linear,
            })
          )
        ),
      ],
      ...[2, 8, 32].map(
        (cost) =>
          [
            `module-level regions merged, λ = ${cost} kB`,
            measure(getRegionSplit(app, assign(cost))),
          ] as const
      ),
      [
        'the same, λ = 8 kB, pinEntries',
        measure(getRegionSplit(app, assign(8, true))),
      ],
    ] as const;
    const lines = [
      `${'strategy'.padEnd(42)} first load kB  session kB  duplicates kB  requests/load  files`,
      ...rows.map(
        ([name, row]) =>
          `${name.padEnd(42)} ${kb(row.firstLoad)}    ${kb(row.session)}  ${kb(row.duplicates)}      ${row.requests.toFixed(1).padStart(8)}      ${String(row.files).padStart(5)}`
      ),
    ];
    const regions = listRegions(app.graph);
    lines.push(
      `regions by the loads that pay for them: ${JSON.stringify(countRegionsByLoads(regions))}`
    );
    for (const cost of [0, 2, 8, 32]) {
      for (const pinEntries of [false, true]) {
        const result = assign(cost, pinEntries);
        const { privateRegions, entry, widest } = describeFiles(
          app,
          regions,
          getRegionSplit(app, result),
          estimateCompressedSize
        );
        const describe = (file: FileWaste | undefined) =>
          file
            ? `${file.messages} messages, ${kb(file.bytes).trim()} kB, loaded by ${(100 * file.routes).toFixed(0)}% of routes, ${file.narrowMessages} messages that under 10% of routes demand, ${kb(file.wastePerRoute).trim()} kB wasted per route load`
            : 'none';
        const startup = describeStartup(app, result, estimateCompressedSize);
        lines.push(
          `λ = ${cost} kB${pinEntries ? ', pinEntries' : ''}: regions of one load ${JSON.stringify(privateRegions)}`,
          `  the entry's files: ${startup.files} with ${startup.messages} messages, ${kb(startup.bytes).trim()} kB, of which the entry demands ${startup.demanded}`,
          `  entry file: ${describe(entry)}`,
          `  widest other file: ${describe(widest)}`
        );
      }
    }
    return lines;
  };

  it('prints time, memory and stability', { timeout: 600_000 }, () => {
    const app = createSyntheticApp({ messages });
    const lines = [
      `${app.sizes.size} messages, ${app.graph.modules.length} modules, ${app.routes.length} routes, ${app.lazy.length} lazy loads`,
    ];
    const options: RegionOptions = { sizes: app.sizes };

    const rss = process.memoryUsage().rss;
    const times: number[] = [];
    let assignment = assignTranslationsByRegion(app.graph, options);
    const peak = process.resourceUsage().maxRSS * 1024;
    for (let run = 0; run < 3; run++) {
      const start = performance.now();
      assignment = assignTranslationsByRegion(app.graph, options);
      times.push(performance.now() - start);
    }
    const start = performance.now();
    const uncovered = findUncoveredMessages(app.graph, assignment);
    const replay = performance.now() - start;
    lines.push(
      `λ = 8 kB: ${Math.round(times.sort((a, b) => a - b)[1])} ms (median of 3), ${assignment.stats.regions} regions, ${assignment.stats.comparisons} comparisons, ${assignment.files.size} files`,
      `resident memory before the first run ${kb(rss / 1024).trim()} MB, peak after it ${kb(peak / 1024).trim()} MB`,
      `replay ${Math.round(replay)} ms, ${uncovered.length} uncovered`
    );
    if (process.env.GT_REGION_REPORT === 'time') {
      process.stdout.write(`${lines.join('\n')}\n`);
      return;
    }

    const weights = new Map(
      [...app.routes, ...app.lazy].map((id, index) => [id, 1 + (index % 7)])
    );
    const weighted = performance.now();
    assignTranslationsByRegion(app.graph, { ...options, weights });
    lines.push(
      `with a weight per load: ${Math.round(performance.now() - weighted)} ms`
    );

    for (const [name, change] of [
      ['no change', (same: SyntheticApp) => same],
      ['one more import', addImport],
      ['one more message', addMessage],
    ] as const) {
      const changed = change(app);
      const scratch = assignTranslationsByRegion(changed.graph, {
        sizes: changed.sizes,
      });
      const begin = performance.now();
      const stable = assignTranslationsByRegion(changed.graph, {
        sizes: changed.sizes,
        previous: getPrevious(assignment.files),
      });
      const time = performance.now() - begin;
      const percent = (part: number, total: number) =>
        `${((100 * part) / total).toFixed(2)}%`;
      for (const [label, result] of [
        ['from nothing', scratch],
        ['with the previous files', stable],
      ] as const) {
        const { total, changedFiles, moved } = compareFiles(
          assignment.files,
          result.files,
          changed.sizes
        );
        lines.push(
          `${name}, ${label}: files that changed hold ${percent(changedFiles, total)} of the bytes, messages that moved ${percent(moved, total)}, ${result.files.size} files`
        );
      }
      lines.push(
        `${name}, with the previous files: ${Math.round(time)} ms, ${findUncoveredMessages(changed.graph, stable).length} uncovered`
      );
    }
    process.stdout.write(`${lines.join('\n')}\n`);
  });

  it.runIf(process.env.GT_REGION_REPORT !== 'time').each([
    ['the measured shape', createSyntheticApp, 'dynamic'],
    ['the measured shape', createSyntheticApp, 'static'],
    ['the stress shape', createStressApp, 'dynamic'],
    ['the stress shape', createStressApp, 'static'],
  ] as const)(
    'prints quality on %s',
    { timeout: 600_000 },
    async (name, create, root) => {
      // Lets the runner report the test before
      await new Promise((resolve) => setTimeout(resolve, 100));
      const app = create({ messages, root });
      process.stdout.write(
        `${[
          '',
          `${name}, with a ${root} import of the root: ${app.sizes.size} messages, ${app.routes.length} routes, ${app.lazy.length} lazy loads`,
          ...describeQuality(app),
        ].join('\n')}\n`
      );
    }
  );
});
