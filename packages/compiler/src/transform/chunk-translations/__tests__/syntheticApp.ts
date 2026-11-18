import type { AssignedChunk } from '../assignTranslations';
import type { RegionGraph, RegionModule } from '../assignTranslationsByRegion';

/**
 * A module graph in the shape of a large production app, with the chunks a
 * bundler that groups shared code would write for it. Its loads overlap as
 * those of the app the research measured: most regions are demanded by more
 * than 20 loads, no route has messages only it demands, and about one load in
 * seven, all of them dialogs, has a small region of its own.
 *
 * - The entry imports a small shell and names every route and every page in
 *   a dynamic import.
 * - A route has no messages. It imports the pages it declares, which are
 *   lazy loads too and which several routes of a product area share, the
 *   area's kits, and one hub module that every route imports.
 * - The hub reaches about 1% of the shared cluster's messages, but its chunk
 *   imports the chunk of every shared group, so by chunk every route loads
 *   the whole cluster.
 * - The cluster is groups of features, components and primitives, one chunk
 *   per group. An area's kits import the features of a run of the groups, so
 *   a route reaches 10 to 42% of the cluster's messages.
 * - An area has modules of its own that a few of its pages import.
 * - A page opens dialogs: lazy loads with a few messages of their own.
 */
export type SyntheticApp = {
  graph: RegionGraph;
  /** The raw bytes of each message */
  sizes: Map<string, number>;
  chunks: AssignedChunk[];
  /** The chunk file of each module */
  chunkOf: Map<string, string>;
  entry: string;
  routes: string[];
  /** The pages and the dialogs */
  lazy: string[];
  /** The modules of the shared cluster */
  cluster: string[];
};

/** The app the numbers of the research describe has this many messages. */
export const FULL_SCALE_MESSAGES = 65_000;

const FEATURES = 12;
const COMPONENTS = 12;
const PRIMITIVES = 12;
const KITS = 3;
// The least and the largest share of the groups an area's routes use
const AREA_SPAN = [0.1, 0.42];
// The share of a group's features a kit imports
const KIT_SHARE = 0.85;
// The modules of its own an area has for each of its routes
const LOCAL_MODULES = 2.8;

export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSyntheticApp({
  messages = FULL_SCALE_MESSAGES,
  seed = 1,
}: {
  messages?: number;
  seed?: number;
} = {}): SyntheticApp {
  const random = createRandom(seed);
  const pick = (count: number) => Math.floor(random() * count);
  const between = (low: number, high: number) => low + pick(high - low + 1);
  const normal = () =>
    Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
  const scale = messages / FULL_SCALE_MESSAGES;
  const routeCount = Math.max(4, Math.round(746 * scale));
  const pageCount = Math.max(4, Math.round(821 * scale));
  const dialogCount = Math.max(2, Math.round(266 * scale));
  const groupCount = Math.max(4, Math.round(114 * scale));
  const areaCount = Math.max(2, Math.round(30 * Math.sqrt(scale)));

  const modules: RegionModule[] = [];
  const byId = new Map<string, RegionModule>();
  const sizes = new Map<string, number>();
  const chunkOf = new Map<string, string>();
  const addMessages = (count: number): string[] =>
    Array.from({ length: count }, () => {
      let hash = '';
      do {
        hash = Array.from({ length: 4 }, () =>
          pick(65536).toString(16).padStart(4, '0')
        ).join('');
      } while (sizes.has(hash));
      sizes.set(
        hash,
        Math.min(600, 28 + Math.floor(-Math.log(1 - random()) * 42))
      );
      return hash;
    });
  const addModule = (id: string, chunk: string, count: number) => {
    const module: RegionModule = {
      id,
      hashes: addMessages(count),
      imports: [],
      dynamicImports: [],
    };
    modules.push(module);
    byId.set(id, module);
    chunkOf.set(id, chunk);
    return module as RegionModule & {
      imports: string[];
      dynamicImports: string[];
    };
  };
  const pad = (index: number) => String(index).padStart(4, '0');

  // The shared cluster
  const cluster: string[] = [];
  const nearby = (group: number) =>
    (group + between(1, 3) * (random() < 0.5 ? 1 : -1) + groupCount) %
    groupCount;
  for (let group = 0; group < groupCount; group++) {
    const chunk = `assets/shared-${pad(group)}.js`;
    const prefix = `src/shared/g${pad(group)}`;
    for (let index = 0; index < PRIMITIVES; index++) {
      cluster.push(
        addModule(`${prefix}/primitive${index}.ts`, chunk, between(2, 9)).id
      );
    }
    for (let index = 0; index < COMPONENTS; index++) {
      cluster.push(
        addModule(`${prefix}/component${index}.tsx`, chunk, between(2, 10)).id
      );
    }
    for (let index = 0; index < FEATURES; index++) {
      cluster.push(
        addModule(`${prefix}/feature${index}.tsx`, chunk, between(4, 12)).id
      );
    }
  }
  const primitiveOf = (group: number) =>
    `src/shared/g${pad(group)}/primitive${pick(PRIMITIVES)}.ts`;
  for (let group = 0; group < groupCount; group++) {
    const prefix = `src/shared/g${pad(group)}`;
    for (let index = 0; index < COMPONENTS; index++) {
      const component = byId.get(`${prefix}/component${index}.tsx`)!;
      const imports = new Set<string>();
      for (let count = between(1, 3); count > 0; count--) {
        imports.add(primitiveOf(random() < 0.75 ? group : nearby(group)));
      }
      // A later component of the group, so that components form no cycle
      if (index + 1 < COMPONENTS && random() < 0.35) {
        imports.add(
          `${prefix}/component${between(index + 1, COMPONENTS - 1)}.tsx`
        );
      }
      (component.imports as string[]).push(...imports);
    }
    for (let index = 0; index < FEATURES; index++) {
      const feature = byId.get(`${prefix}/feature${index}.tsx`)!;
      const imports = new Set<string>();
      for (let count = between(2, 4); count > 0; count--) {
        const from = random() < 0.8 ? group : nearby(group);
        imports.add(
          `src/shared/g${pad(from)}/component${pick(COMPONENTS)}.tsx`
        );
      }
      (feature.imports as string[]).push(...imports);
    }
  }

  // The hub every route imports reaches one primitive of half the groups
  const hub = addModule('src/app/hub.ts', 'assets/hub.js', 4);
  for (let group = 0; group < groupCount; group += 2) {
    hub.imports.push(primitiveOf(group));
  }

  const entry = addModule('src/main.tsx', 'assets/index.js', 12);
  for (let index = 0; index < 20; index++) {
    const shell = addModule(
      `src/app/shell${index}.tsx`,
      'assets/index.js',
      between(10, 22)
    );
    entry.imports.push(shell.id);
  }

  // Each product area uses a run of the groups. Its base kit, which all of
  // its routes import, pulls in most of their features; two more kits, which
  // some routes import, pull in features of the groups next to them. So the
  // routes of an area demand much the same, and no two modules quite the same.
  const spans = Array.from({ length: areaCount }, () =>
    Math.max(
      2,
      Math.round(
        groupCount * (AREA_SPAN[0] + (AREA_SPAN[1] - AREA_SPAN[0]) * random())
      )
    )
  );
  const startOf = (area: number) => Math.floor((area * groupCount) / areaCount);
  const featureOf = (area: number) =>
    `src/shared/g${pad((startOf(area) + pick(spans[area])) % groupCount)}/feature${pick(FEATURES)}.tsx`;
  for (let area = 0; area < areaCount; area++) {
    for (let index = 0; index < KITS; index++) {
      const kit = addModule(
        `src/areas/a${pad(area)}/kit${index}.ts`,
        `assets/area-${pad(area)}.js`,
        between(1, 4)
      );
      const first = index === 0 ? 0 : spans[area] + (index - 1) * 2;
      const length = index === 0 ? spans[area] : 2;
      for (let offset = first; offset < first + length; offset++) {
        const group = (startOf(area) + offset) % groupCount;
        for (let feature = 0; feature < FEATURES; feature++) {
          if (random() < KIT_SHARE) {
            kit.imports.push(`src/shared/g${pad(group)}/feature${feature}.tsx`);
          }
        }
      }
    }
  }

  // What an area has of its own: modules that a few of its pages import
  const localCount = Math.max(
    3,
    Math.round((LOCAL_MODULES * routeCount) / areaCount)
  );
  for (let area = 0; area < areaCount; area++) {
    for (let index = 0; index < localCount; index++) {
      const local = addModule(
        `src/areas/a${pad(area)}/local${index}.tsx`,
        `assets/area-${pad(area)}.js`,
        between(3, 12)
      );
      if (random() < 0.5) {
        local.imports.push(
          primitiveOf((startOf(area) + pick(spans[area])) % groupCount)
        );
      }
    }
  }

  // Pages: lazy loads that the routes of an area declare
  const routes: string[] = [];
  const lazy: string[] = [];
  const pagesOf = Array.from({ length: areaCount }, () => [] as string[]);
  for (let index = 0; index < pageCount; index++) {
    const area = index % areaCount;
    const id = `src/pages/p${pad(index)}.tsx`;
    const page = addModule(id, `assets/page-${pad(index)}.js`, between(6, 38));
    lazy.push(id);
    pagesOf[area].push(id);
    entry.dynamicImports.push(id);
    const imports = new Set<string>();
    for (let count = between(2, 7); count > 0; count--) {
      imports.add(`src/areas/a${pad(area)}/local${pick(localCount)}.tsx`);
    }
    for (let count = between(1, 6); count > 0; count--) {
      imports.add(featureOf(random() < 0.9 ? area : pick(areaCount)));
    }
    page.imports.push(...imports);
  }
  const declared = Array.from({ length: routeCount }, () => new Set<string>());
  const routesOf = (area: number) =>
    Array.from(
      { length: Math.ceil((routeCount - area) / areaCount) },
      (_, index) => area + index * areaCount
    );
  pagesOf.forEach((pages, area) => {
    const inArea = routesOf(area);
    if (!inArea.length) return;
    for (const page of pages) {
      // Most pages belong to one or two routes, a few to many
      const share = random();
      const count =
        share < 0.3 ? 1 : share < 0.6 ? 2 : share < 0.8 ? 3 : between(4, 7);
      for (let left = count; left > 0; left--) {
        declared[inArea[pick(inArea.length)]].add(page);
      }
    }
  });
  for (let index = 0; index < routeCount; index++) {
    const area = index % areaCount;
    const id = `src/routes/r${pad(index)}.tsx`;
    const route = addModule(id, `assets/route-${pad(index)}.js`, 0);
    routes.push(id);
    entry.dynamicImports.push(id);
    if (!declared[index].size && pagesOf[area].length) {
      declared[index].add(pagesOf[area][pick(pagesOf[area].length)]);
    }
    const imports = new Set([hub.id, `src/areas/a${pad(area)}/kit0.ts`]);
    for (let kit = 1; kit < KITS; kit++) {
      if (random() < 0.3) imports.add(`src/areas/a${pad(area)}/kit${kit}.ts`);
    }
    route.imports.push(...imports, ...declared[index]);
  }

  // Dialogs: lazy loads a page opens, with a few messages of their own
  for (let index = 0; index < dialogCount; index++) {
    const opener = byId.get(lazy[pick(pageCount)])!;
    const id = `src/dialogs/d${pad(index)}.tsx`;
    const own = Math.min(
      250,
      Math.max(1, Math.round(8 * Math.exp(1.1 * normal())))
    );
    const dialog = addModule(id, `assets/dialog-${pad(index)}.js`, own);
    lazy.push(id);
    (opener.dynamicImports as string[]).push(id);
    // What it shares, the page that opens it holds already
    for (
      let count = between(0, 3);
      count > 0 && opener.imports.length;
      count--
    ) {
      dialog.imports.push(opener.imports[pick(opener.imports.length)]);
    }
  }

  // A bundler leaves out what nothing imports
  const reached = new Set([entry.id]);
  const pending = [entry.id];
  for (let id = pending.pop(); id; id = pending.pop()) {
    const module = byId.get(id)!;
    for (const next of [...module.imports, ...module.dynamicImports]) {
      if (reached.has(next)) continue;
      reached.add(next);
      pending.push(next);
    }
  }
  const bundled = modules.filter((module) => reached.has(module.id));
  const kept = new Set(bundled.flatMap((module) => module.hashes));
  for (const hash of sizes.keys()) if (!kept.has(hash)) sizes.delete(hash);

  return {
    graph: { modules: bundled, entries: [entry.id] },
    sizes,
    chunks: getChunks(bundled, chunkOf, [entry.id]),
    chunkOf,
    entry: entry.id,
    routes,
    lazy,
    cluster: cluster.filter((id) => reached.has(id)),
  };
}

/** The app createStressApp is modelled on has this many messages. */
export const STRESS_SCALE_MESSAGES = 70_000;

/**
 * A module graph whose loads overlap in the way that is hardest on the rule,
 * as the load benchmark's `app` shape does: half of the regions are paid for
 * by exactly two loads that share nothing else, because routes and dialogs
 * repeat single messages of each other at random. Merging chains such pairs
 * into wide files.
 *
 * - Every route and every dialog has messages only it demands.
 * - 16% of the messages are repeated: most by two loads, a third by three to
 *   five and a tenth by six to twenty.
 * - 42% of the messages are in a pool of shared modules, of which a route
 *   imports a quarter, picked at random.
 */
export function createStressApp({
  messages = STRESS_SCALE_MESSAGES,
  seed = 1,
}: {
  messages?: number;
  seed?: number;
} = {}): SyntheticApp {
  const random = createRandom(seed);
  const pick = (count: number) => Math.floor(random() * count);
  const scale = messages / STRESS_SCALE_MESSAGES;
  const routeCount = Math.max(6, Math.round(754 * scale));
  const dialogCount = Math.max(3, Math.round(431 * scale));
  const poolCount = Math.max(6, Math.round(188 * scale));
  const entryMessages = Math.max(20, Math.round(330 * Math.sqrt(scale)));

  const modules: RegionModule[] = [];
  const sizes = new Map<string, number>();
  const chunkOf = new Map<string, string>();
  const addMessage = (): string => {
    let hash = '';
    do {
      hash = Array.from({ length: 4 }, () =>
        pick(65536).toString(16).padStart(4, '0')
      ).join('');
    } while (sizes.has(hash));
    sizes.set(
      hash,
      Math.min(600, 28 + Math.floor(-Math.log(1 - random()) * 42))
    );
    return hash;
  };
  const addModule = (id: string, chunk: string, count: number) => {
    const module = {
      id,
      hashes: Array.from({ length: count }, addMessage),
      imports: [] as string[],
      dynamicImports: [] as string[],
    };
    modules.push(module);
    chunkOf.set(id, chunk);
    return module;
  };

  const entry = addModule('src/main.tsx', 'assets/index.js', 0);
  entry.imports.push(
    addModule('src/shell.tsx', 'assets/index.js', entryMessages).id
  );
  const pool = Array.from({ length: poolCount }, (_, index) =>
    addModule(
      `src/pool/p${index}.tsx`,
      `assets/pool-${index >> 1}.js`,
      Math.max(1, Math.round((0.42 * messages) / poolCount))
    )
  );
  const cluster = pool.map((module) => module.id);

  // What a route or a dialog has of its own, spread unevenly
  const loadCount = routeCount + dialogCount;
  const shares = Array.from({ length: loadCount }, () =>
    Math.exp(
      1.2 *
        Math.sqrt(-2 * Math.log(1 - random())) *
        Math.cos(2 * Math.PI * random())
    )
  );
  const total = shares.reduce((sum, share) => sum + share, 0);
  const own = 0.42 * messages - entryMessages;
  const loads = shares.map((share, index) => {
    const isRoute = index < routeCount;
    const id = isRoute
      ? `src/routes/r${index}.tsx`
      : `src/dialogs/d${index - routeCount}.tsx`;
    return addModule(
      id,
      `assets/${isRoute ? 'route' : 'dialog'}-${index}.js`,
      Math.max(1, Math.round((own * share) / total))
    );
  });
  const routes = loads.slice(0, routeCount);
  const dialogs = loads.slice(routeCount);
  for (const route of routes) {
    entry.dynamicImports.push(route.id);
    for (const module of pool) {
      if (random() < 0.25) route.imports.push(module.id);
    }
  }
  for (const dialog of dialogs) {
    routes[pick(routeCount)].dynamicImports.push(dialog.id);
    if (random() < 0.5) dialog.imports.push(pool[pick(poolCount)].id);
  }

  // Messages that loads repeat of each other
  for (let left = Math.round(0.16 * messages); left > 0; left--) {
    const hash = addMessage();
    const share = random();
    const count = share < 0.56 ? 2 : share < 0.9 ? 3 + pick(3) : 6 + pick(15);
    const repeating = new Set<number>();
    while (repeating.size < Math.min(count, loadCount)) {
      repeating.add(pick(loadCount));
    }
    for (const load of repeating) loads[load].hashes.push(hash);
  }

  return {
    graph: { modules, entries: [entry.id] },
    sizes,
    chunks: getChunks(modules, chunkOf, [entry.id]),
    chunkOf,
    entry: entry.id,
    routes: routes.map((route) => route.id),
    lazy: dialogs.map((dialog) => dialog.id),
    cluster,
  };
}

/** The chunks of a graph whose modules have each been given a chunk file. */
export function getChunks(
  modules: readonly RegionModule[],
  chunkOf: ReadonlyMap<string, string>,
  entries: readonly string[]
): AssignedChunk[] {
  const chunks = new Map<
    string,
    { hashes: Set<string>; imports: Set<string>; dynamicImports: Set<string> }
  >();
  for (const module of modules) {
    const file = chunkOf.get(module.id)!;
    let chunk = chunks.get(file);
    if (!chunk) {
      chunk = {
        hashes: new Set(),
        imports: new Set(),
        dynamicImports: new Set(),
      };
      chunks.set(file, chunk);
    }
    for (const hash of module.hashes) chunk.hashes.add(hash);
    for (const imported of module.imports) {
      if (chunkOf.get(imported) !== file)
        chunk.imports.add(chunkOf.get(imported)!);
    }
    for (const imported of module.dynamicImports) {
      chunk.dynamicImports.add(chunkOf.get(imported)!);
    }
  }
  const entryFiles = new Set(entries.map((entry) => chunkOf.get(entry)));
  return [...chunks].map(([fileName, chunk]) => ({
    fileName,
    hashes: [...chunk.hashes].sort(),
    imports: [...chunk.imports],
    dynamicImports: [...chunk.dynamicImports],
    isEntry: entryFiles.has(fileName),
  }));
}

/** The files a page holds at each step, under one way of splitting messages. */
export type Split = {
  /** The hashes in each file */
  files: Map<string, string[]>;
  /** The files a page holds before any code runs */
  entry: string[];
  /** The files a page that holds only those adds for a route */
  getRouteFiles: (route: string) => string[];
};

export type SplitQuality = {
  /** Mean bytes a page downloads for the entry and one route */
  firstLoad: number;
  /** Mean requests for the same */
  requests: number;
  /** Mean bytes a page downloads for the entry and five routes */
  session: number;
  /** Mean bytes of the messages such a session downloads more than once */
  duplicates: number;
  files: number;
};

/**
 * What a split costs the routes of an app. A file weighs what `estimateSize`
 * returns for its raw bytes.
 */
export function measureSplit(
  app: SyntheticApp,
  split: Split,
  estimateSize: (bytes: number) => number,
  seed = 7
): SplitQuality {
  const raw = new Map<string, number>();
  const weight = new Map<string, number>();
  for (const [key, hashes] of split.files) {
    let bytes = 0;
    for (const hash of hashes) bytes += app.sizes.get(hash)!;
    raw.set(key, bytes);
    weight.set(key, estimateSize(bytes));
  }
  const sum = (keys: Iterable<string>) => {
    let bytes = 0;
    for (const key of keys) bytes += weight.get(key)!;
    return bytes;
  };
  let firstLoad = 0;
  let requests = 0;
  const routeFiles = new Map(
    app.routes.map((route) => [route, split.getRouteFiles(route)])
  );
  for (const files of routeFiles.values()) {
    const held = new Set([...split.entry, ...files]);
    firstLoad += sum(held);
    requests += held.size;
  }
  const random = createRandom(seed);
  const sessions = 200;
  let session = 0;
  let duplicates = 0;
  for (let index = 0; index < sessions; index++) {
    const held = new Set(split.entry);
    for (let visit = 0; visit < 5; visit++) {
      const route = app.routes[Math.floor(random() * app.routes.length)];
      for (const key of routeFiles.get(route)!) held.add(key);
    }
    session += sum(held);
    const seen = new Set<string>();
    for (const key of held) {
      let repeated = 0;
      for (const hash of split.files.get(key)!) {
        if (seen.has(hash)) repeated += app.sizes.get(hash)!;
        else seen.add(hash);
      }
      if (repeated) duplicates += (weight.get(key)! * repeated) / raw.get(key)!;
    }
  }
  return {
    firstLoad: firstLoad / app.routes.length,
    requests: requests / app.routes.length,
    session: session / sessions,
    duplicates: duplicates / sessions,
    files: split.files.size,
  };
}

/** The file each message is in, as the next build reads it. */
export function getPrevious(files: Map<string, string[]>): Map<string, string> {
  const previous = new Map<string, string>();
  for (const [key, hashes] of files) {
    for (const hash of hashes) previous.set(hash, key);
  }
  return previous;
}

/**
 * How much of a build's files a page that has the files of the build before
 * cannot reuse, in raw bytes.
 */
export function compareFiles(
  before: Map<string, string[]>,
  after: Map<string, string[]>,
  sizes: ReadonlyMap<string, number>
): {
  total: number;
  /** The bytes of the files that are not, message for message, a file of the build before */
  changedFiles: number;
  /** The bytes of the messages that left the file most of their new file came from */
  moved: number;
} {
  const weigh = (hashes: Iterable<string>) => {
    let bytes = 0;
    for (const hash of hashes) bytes += sizes.get(hash) ?? 0;
    return bytes;
  };
  const known = new Set([...before.values()].map((hashes) => hashes.join()));
  const previous = getPrevious(before);
  let total = 0;
  let changedFiles = 0;
  let moved = 0;
  for (const hashes of after.values()) {
    const bytes = weigh(hashes);
    total += bytes;
    if (!known.has(hashes.join())) changedFiles += bytes;
    const origins = new Map<string, string[]>();
    for (const hash of hashes) {
      const origin = previous.get(hash);
      if (origin === undefined) continue;
      const together = origins.get(origin);
      if (together) together.push(hash);
      else origins.set(origin, [hash]);
    }
    const kept = Math.max(0, ...[...origins.values()].map(weigh));
    moved += weigh([...origins.values()].flat()) - kept;
  }
  return { total, changedFiles, moved };
}

const modulesById = new WeakMap<RegionGraph, Map<string, RegionModule>>();

function getReached(app: SyntheticApp, start: string): Set<string> {
  let byId = modulesById.get(app.graph);
  if (!byId) {
    byId = new Map(app.graph.modules.map((module) => [module.id, module]));
    modulesById.set(app.graph, byId);
  }
  const reached = new Set([start]);
  const pending = [start];
  for (let id = pending.pop(); id; id = pending.pop()) {
    for (const next of byId.get(id)!.imports) {
      if (reached.has(next)) continue;
      reached.add(next);
      pending.push(next);
    }
  }
  return reached;
}

function withModule(
  app: SyntheticApp,
  id: string,
  change: (module: RegionModule) => RegionModule
): SyntheticApp {
  const modules = app.graph.modules.map((module) =>
    module.id === id ? change(module) : module
  );
  return {
    ...app,
    graph: { ...app.graph, modules },
    chunks: getChunks(modules, app.chunkOf, app.graph.entries),
  };
}

/** The app with one more static import: a route imports a feature it did not reach. */
export function addImport(app: SyntheticApp, seed = 3): SyntheticApp {
  const random = createRandom(seed);
  const route = app.routes[Math.floor(random() * app.routes.length)];
  const reached = getReached(app, route);
  const features = app.cluster.filter(
    (id) => id.includes('/feature') && !reached.has(id)
  );
  const feature = features[Math.floor(random() * features.length)];
  return withModule(app, route, (module) => ({
    ...module,
    imports: [...module.imports, feature],
  }));
}

export const ADDED_MESSAGE = 'added-message';

/** The app with one more message, in a component of the shared cluster. */
export function addMessage(app: SyntheticApp, seed = 3): SyntheticApp {
  const random = createRandom(seed);
  const components = app.cluster.filter((id) => id.includes('/component'));
  const component = components[Math.floor(random() * components.length)];
  return {
    ...withModule(app, component, (module) => ({
      ...module,
      hashes: [...module.hashes, ADDED_MESSAGE],
    })),
    sizes: new Map([...app.sizes, [ADDED_MESSAGE, 70]]),
  };
}

/** How many regions so many loads pay for. */
export function countRegionsByLoads(
  regions: readonly { loads: readonly string[] }[]
): Record<'1' | '2' | '3 to 5' | '6 to 20' | 'over 20', number> {
  const counts = { '1': 0, '2': 0, '3 to 5': 0, '6 to 20': 0, 'over 20': 0 };
  for (const { loads } of regions) {
    const count = loads.length;
    counts[
      count <= 1
        ? '1'
        : count === 2
          ? '2'
          : count <= 5
            ? '3 to 5'
            : count <= 20
              ? '6 to 20'
              : 'over 20'
    ]++;
  }
  return counts;
}

export type FileWaste = {
  key: string;
  messages: number;
  bytes: number;
  /** The share of the routes that load the file */
  routes: number;
  /** Its messages that fewer than one route in ten demands */
  narrowMessages: number;
  /** The bytes of it a route that loads it does not demand, on average */
  wastePerRoute: number;
};

/**
 * Where the regions that one load pays for ended up, and what the entry's
 * file and the widest other file make a route download that it does not
 * demand. A file weighs what `estimateSize` returns for its raw bytes, and a
 * part of it its share of the raw bytes.
 */
export function describeFiles(
  app: SyntheticApp,
  regions: readonly { hashes: readonly string[]; loads: readonly string[] }[],
  split: Split,
  estimateSize: (bytes: number) => number
): {
  privateRegions: { alone: number; inShared: number; inEntry: number };
  entry: FileWaste | undefined;
  widest: FileWaste | undefined;
} {
  const fileOf = getPrevious(split.files);
  const entryKeys = new Set(split.entry);
  const privateRegions = { alone: 0, inShared: 0, inEntry: 0 };
  for (const region of regions) {
    if (region.loads.length !== 1) continue;
    const key = fileOf.get(region.hashes[0])!;
    if (entryKeys.has(key)) privateRegions.inEntry++;
    else if (split.files.get(key)!.length === region.hashes.length) {
      privateRegions.alone++;
    } else privateRegions.inShared++;
  }

  const routeFiles = new Map(
    app.routes.map((route) => [route, new Set(split.getRouteFiles(route))])
  );
  const listed = new Map<string, number>();
  for (const files of routeFiles.values()) {
    for (const key of files) listed.set(key, (listed.get(key) ?? 0) + 1);
  }
  const [widestKey] = [...listed]
    .filter(([key]) => !entryKeys.has(key))
    .sort(
      ([a, x], [b, y]) =>
        y - x || split.files.get(b)!.length - split.files.get(a)!.length
    )
    .map(([key]) => key);
  const [entryKey] = split.entry;

  const byId = new Map(app.graph.modules.map((module) => [module.id, module]));
  const entryModules = getReached(app, app.entry);
  const describe = (key: string | undefined): FileWaste | undefined => {
    if (key === undefined) return undefined;
    const hashes = new Set(split.files.get(key));
    const weigh = (list: Iterable<string>) => {
      let bytes = 0;
      for (const hash of list) bytes += app.sizes.get(hash) ?? 0;
      return bytes;
    };
    const raw = weigh(hashes);
    const bytes = estimateSize(raw);
    const demandedBy = new Map<string, number>();
    let loading = 0;
    let wasted = 0;
    for (const route of app.routes) {
      const demanded = new Set<string>();
      for (const id of [...getReached(app, route), ...entryModules]) {
        for (const hash of byId.get(id)!.hashes) {
          if (hashes.has(hash)) demanded.add(hash);
        }
      }
      for (const hash of demanded) {
        demandedBy.set(hash, (demandedBy.get(hash) ?? 0) + 1);
      }
      if (!entryKeys.has(key) && !routeFiles.get(route)!.has(key)) continue;
      loading++;
      wasted += raw ? (bytes * (raw - weigh(demanded))) / raw : 0;
    }
    return {
      key,
      messages: hashes.size,
      bytes,
      routes: loading / app.routes.length,
      narrowMessages: [...hashes].filter(
        (hash) => (demandedBy.get(hash) ?? 0) < app.routes.length / 10
      ).length,
      wastePerRoute: loading ? wasted / loading : 0,
    };
  };
  return {
    privateRegions,
    entry: describe(entryKey),
    widest: describe(widestKey),
  };
}

/** What a route downloads of the entry's file without demanding it, on average. */
export function getEntryWaste(
  app: SyntheticApp,
  regions: readonly { hashes: readonly string[]; loads: readonly string[] }[],
  split: Split,
  estimateSize: (bytes: number) => number
): number {
  return (
    describeFiles(app, regions, split, estimateSize).entry?.wastePerRoute ?? 0
  );
}
