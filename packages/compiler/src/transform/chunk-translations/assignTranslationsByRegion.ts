import { mergeRegions } from './mergeRegions';

/** A source module of the build. */
export type RegionModule = {
  id: string;
  /**
   * The hashes of the messages its call sites hold in the final output. A
   * graph of pairs (see createRegionGraph) holds a pair in place of each
   * hash, and what is said here of a hash or of a message is then said of
   * a pair.
   */
  hashes: readonly string[];
  /** The ids of the modules it imports statically */
  imports: readonly string[];
  /** The ids of the modules it imports dynamically */
  dynamicImports: readonly string[];
  /**
   * The hashes of its call sites that run when the module is initialised.
   * They count as its messages too. Only a graph with `evaluated` tells them
   * apart from `hashes`.
   */
  initialHashes?: readonly string[];
};

export type RegionGraph = {
  modules: readonly RegionModule[];
  /** The ids of the modules a page starts from */
  entries: readonly string[];
  /**
   * For a build that initialises every module of a chunk when the chunk
   * loads: by the id of each load point, the modules that are initialised
   * when it loads, that is the modules of every chunk it pulls in. A load
   * then also demands their `initialHashes`. Leave it out when the bundler
   * initialises a module only when it is first imported (Rolldown's
   * `strictExecutionOrder`).
   */
  evaluated?: ReadonlyMap<string, readonly string[]>;
};

export type RegionOptions = {
  /**
   * The raw bytes of each message, one size for every locale so that all of
   * them are split the same way. A message without a size weighs nothing.
   */
  sizes: ReadonlyMap<string, number>;
  /**
   * λ: what one more request costs a load, in the bytes `estimateSize`
   * returns. Defaults to DEFAULT_REQUEST_COST.
   */
  requestCost?: number;
  /**
   * The size a file of so many raw bytes downloads as. It must never decrease
   * as the bytes grow. Defaults to estimateCompressedSize.
   */
  estimateSize?: (bytes: number) => number;
  /**
   * How often each load point loads, by its id. A load without a weight
   * loads once for itself and once for each time a load that can only run
   * after it loads, so an entry weighs as much as all that its pages load.
   */
  weights?: ReadonlyMap<string, number>;
  /** The key of the file each message was in after the previous build */
  previous?: ReadonlyMap<string, string>;
  /**
   * Keeps what the entries demand in files that hold nothing else, which
   * costs a page one more request and leaves files small enough to inline.
   */
  pinEntries?: boolean;
};

/**
 * Which messages go into which translations file, and which files each place
 * that loads code must hold. It has the fields of TranslationAssignment, and
 * differs from it in three ways:
 *
 * - `entries` and `imports` name modules, not chunk files: a load point is
 *   the module a page starts from or a dynamic import names.
 * - A file's key is not a chunk's. A file holds the messages of modules from
 *   many chunks, and a load point holds several files.
 * - `entries` lists file keys, not hashes. An entry's messages are in
 *   `files` like every other, so that no message of the graph is in two
 *   files. In a graph of pairs that is a pair: the message itself is then
 *   in a file for each chunk that reads it.
 *
 * The build writes `demands` as the list of each import (see
 * writeRegionTranslations): gt-react skips the files a page holds, so one
 * list per imported module serves every place that imports it. `imports` and
 * `getImportedFiles` are those lists without what is certainly held, for a
 * loader that cannot skip.
 */
export type RegionAssignment = {
  /**
   * The keys of the files each entry holds before any code runs, by the
   * entry's module. They hold everything the entry demands.
   */
  entries: Map<string, string[]>;
  /**
   * The hashes in each file, by its key, or the pairs of a graph of pairs.
   * Each is in exactly one file.
   */
  files: Map<string, string[]>;
  /**
   * The keys of the files a dynamic import of a module loads, by the module,
   * on a page that started from an entry and holds nothing else.
   */
  imports: Map<string, string[]>;
  /**
   * The same for the import written in the module `importer`, without the
   * files every load that runs `importer` holds already.
   */
  getImportedFiles: (importer: string, target: string) => string[];
  /**
   * The keys of every file that holds something a dynamic import of a module
   * demands, by the module: `imports` with the files the entries hold. A page
   * that holds them holds every message the load reads, whatever it held
   * before.
   */
  demands: Map<string, string[]>;
  stats: {
    /** Entries and targets of dynamic imports */
    loads: number;
    /** Groups of messages that the same loads demand, before merging */
    regions: number;
    /** Pairs of files compared while merging */
    comparisons: number;
    /**
     * Whether the graph had `evaluated`: the build runs every module of a
     * chunk when the chunk loads, so a load also demands what those modules
     * run when they are initialised.
     */
    isConservative: boolean;
    /**
     * The messages that some load demands for that reason alone, without
     * reaching their module. A build that initialises modules lazily has none.
     */
    conservativeMessages: number;
    /**
     * The messages in the files of `entries`, which every page requests
     * before any code runs, and their bytes in the unit of `sizes`
     */
    startupMessages: number;
    startupBytes: number;
    /**
     * The messages the entries demand themselves and their bytes: the least
     * those files can hold
     */
    entryMessages: number;
    entryBytes: number;
  };
};

/** A message a load demands that is in no file the load holds. */
export type UncoveredMessage = {
  /** The module the page started from or the dynamic import names */
  load: string;
  /** The module the dynamic import is written in, for its own list of files */
  importer?: string;
  hash: string;
};

/** λ: a request costs a load as much as downloading this many bytes. */
export const DEFAULT_REQUEST_COST = 8 * 1024;

// gzip finds no repetition further back than this
const COMPRESSION_WINDOW = 32 * 1024;

/**
 * `overhead + factor * bytes ** exponent`, and a straight line past gzip's
 * window, where a file compresses a little better than the window did on
 * average and a little worse than the curve would go on.
 */
function createSizeEstimate(
  overhead: number,
  factor: number,
  exponent: number
): (bytes: number) => number {
  const atWindow = overhead + factor * COMPRESSION_WINDOW ** exponent;
  const rate =
    (factor * (1 + exponent) * COMPRESSION_WINDOW ** (exponent - 1) +
      overhead / COMPRESSION_WINDOW) /
    2;
  return (bytes) =>
    bytes <= COMPRESSION_WINDOW
      ? overhead + factor * bytes ** exponent
      : atWindow + rate * (bytes - COMPRESSION_WINDOW);
}

/**
 * The gzip size of a translations file of so many raw bytes:
 * `20 + 1.57 * bytes ** 0.86` up to 32 kB, and 0.34 bytes for each byte
 * beyond that. A larger file compresses better, so merging two files saves
 * bytes.
 *
 * How well a file compresses depends on how long its messages are, since a
 * hash hardly compresses. This curve is within 9% both of this repository's
 * example translation files and of the files of the load benchmark's apps,
 * whose messages are a third as long. fitCompressedSize fits the curve to a
 * build's own translations.
 */
export const estimateCompressedSize = createSizeEstimate(20, 1.57, 0.86);

/**
 * The curve of estimateCompressedSize that fits files of a build's own
 * translations best: each sample is the raw bytes of a file, in the unit of
 * `sizes`, and what it compressed to. Returns estimateCompressedSize when the
 * samples are too few to fit.
 */
export function fitCompressedSize(
  samples: readonly { bytes: number; compressed: number }[]
): (bytes: number) => number {
  const inWindow = samples.filter(
    ({ bytes, compressed }) =>
      bytes > 0 && bytes <= COMPRESSION_WINDOW && compressed > 0
  );
  let best: ((bytes: number) => number) | undefined;
  let bestError = Infinity;
  for (let overhead = 0; overhead <= 40; overhead += 2) {
    const fitted = inWindow.filter(({ compressed }) => compressed > overhead);
    if (fitted.length < 3) continue;
    for (let step = 0; step <= 30; step++) {
      const exponent = 0.7 + step / 100;
      // The factor that is right on average, on a logarithmic scale
      let logFactor = 0;
      for (const { bytes, compressed } of fitted) {
        logFactor +=
          Math.log(compressed - overhead) - exponent * Math.log(bytes);
      }
      const estimate = createSizeEstimate(
        overhead,
        Math.exp(logFactor / fitted.length),
        exponent
      );
      let error = 0;
      for (const { bytes, compressed } of inWindow) {
        error += Math.log(estimate(bytes) / compressed) ** 2;
      }
      if (error < bestError) {
        best = estimate;
        bestError = error;
      }
    }
  }
  return best ?? estimateCompressedSize;
}

type IndexedGraph = {
  ids: string[];
  indexes: Map<string, number>;
  imports: number[][];
  dynamicImports: number[][];
  /** The module of each load point, in the order of their ids */
  loads: number[];
  /** The load point of each module, -1 for none */
  loadOf: Int32Array;
  isEntry: boolean[];
  isTarget: boolean[];
  /** The entries that reach each load point through any imports */
  pages: number[][];
};

function indexGraph(graph: RegionGraph): IndexedGraph {
  const ids = graph.modules.map((module) => module.id);
  const indexes = new Map(ids.map((id, index) => [id, index]));
  const resolve = (imported: readonly string[]) => [
    ...new Set(
      imported.flatMap((id) => {
        const index = indexes.get(id);
        return index === undefined ? [] : [index];
      })
    ),
  ];
  const imports = graph.modules.map((module) => resolve(module.imports));
  const dynamicImports = graph.modules.map((module) =>
    resolve(module.dynamicImports)
  );
  const entries = new Set(resolve(graph.entries));
  const targets = new Set(dynamicImports.flat());
  const loads = [...new Set([...entries, ...targets])].sort((a, b) =>
    ids[a] < ids[b] ? -1 : 1
  );
  const loadOf = new Int32Array(ids.length).fill(-1);
  loads.forEach((module, load) => (loadOf[module] = load));

  const pages: number[][] = loads.map(() => []);
  const seen = new Int32Array(ids.length).fill(-1);
  loads.forEach((start, entry) => {
    if (!entries.has(start)) return;
    const pending = [start];
    seen[start] = entry;
    for (let module = pending.pop(); module !== undefined; ) {
      if (loadOf[module] !== -1) pages[loadOf[module]].push(entry);
      for (const edges of [imports[module], dynamicImports[module]]) {
        for (const next of edges) {
          if (seen[next] === entry) continue;
          seen[next] = entry;
          pending.push(next);
        }
      }
      module = pending.pop();
    }
  });
  return {
    ids,
    indexes,
    imports,
    dynamicImports,
    loads,
    loadOf,
    isEntry: loads.map((module) => entries.has(module)),
    isTarget: loads.map((module) => targets.has(module)),
    pages,
  };
}

/** A module with every module it imports statically, directly or not. */
function getClosure(
  imports: number[][],
  start: number,
  seen: Int32Array,
  mark: number
): number[] {
  const closure = [start];
  seen[start] = mark;
  for (let index = 0; index < closure.length; index++) {
    for (const next of imports[closure[index]]) {
      if (seen[next] === mark) continue;
      seen[next] = mark;
      closure.push(next);
    }
  }
  return closure;
}

function getWords(bits: number): number {
  return Math.max(1, Math.ceil(bits / 32));
}

function hasBit(rows: Uint32Array, offset: number, bit: number): boolean {
  return (rows[offset + (bit >>> 5)] & (1 << (bit & 31))) !== 0;
}

function setBit(rows: Uint32Array, offset: number, bit: number): void {
  rows[offset + (bit >>> 5)] |= 1 << (bit & 31);
}

function getBits(rows: Uint32Array, offset: number, words: number): number[] {
  const bits: number[] = [];
  for (let word = 0; word < words; word++) {
    for (let rest = rows[offset + word]; rest !== 0; rest &= rest - 1) {
      bits.push(word * 32 + 31 - Math.clz32(rest & -rest));
    }
  }
  return bits;
}

/** The first bit of a row at or after `from`, -1 when there is none. */
function findBit(
  rows: Uint32Array,
  offset: number,
  words: number,
  from: number
): number {
  for (let word = from >>> 5; word < words; word++) {
    let rest = rows[offset + word];
    if (word === from >>> 5) rest &= -1 << (from & 31);
    if (rest !== 0) return word * 32 + 31 - Math.clz32(rest & -rest);
  }
  return -1;
}

/**
 * The load each load can only run after, nearest first: its immediate
 * dominator in the graph of dynamic imports, in which a page starts at an
 * entry. -1 for a load that no single load has to run before: an entry, a
 * load that several entries import, and one that no entry leads to. `order`
 * lists the loads so that each comes after every load it dominates.
 * `importedIn` has a row for each load, of the loads that import it.
 */
function findDominators(
  importedIn: Uint32Array,
  words: number,
  isEntry: readonly boolean[]
): { dominators: Int32Array; order: number[] } {
  const count = isEntry.length;
  // Where every page starts
  const root = count;
  const imported = new Uint32Array(count * words);
  for (let target = 0; target < count; target++) {
    for (const source of getBits(importedIn, target * words, words)) {
      setBit(imported, source * words, target);
    }
  }
  // Where each load is in `order`
  const position = new Int32Array(count + 1).fill(-1);
  const order: number[] = [];
  const visit = (start: number) => {
    position[start] = count;
    const path = [start];
    const next = [0];
    while (path.length) {
      const load = path[path.length - 1];
      const target = findBit(
        imported,
        load * words,
        words,
        next[next.length - 1]
      );
      if (target === -1) {
        position[load] = order.length;
        order.push(load);
        path.pop();
        next.pop();
        continue;
      }
      next[next.length - 1] = target + 1;
      if (position[target] !== -1) continue;
      position[target] = count;
      path.push(target);
      next.push(0);
    }
  };
  for (let load = 0; load < count; load++) {
    if (isEntry[load] && position[load] === -1) visit(load);
  }
  // A load that no entry leads to starts a page of its own
  const isStart = isEntry.map((entry, load) => entry || position[load] === -1);
  for (let load = 0; load < count; load++) {
    if (position[load] === -1) visit(load);
  }
  position[root] = count;

  const dominators = new Int32Array(count + 1).fill(-1);
  dominators[root] = root;
  const getShared = (first: number, second: number): number => {
    while (first !== second) {
      while (position[first] < position[second]) first = dominators[first];
      while (position[second] < position[first]) second = dominators[second];
    }
    return first;
  };
  for (let isSettled = false; !isSettled; ) {
    isSettled = true;
    for (let at = count - 1; at >= 0; at--) {
      const load = order[at];
      let nearest = isStart[load] ? root : -1;
      const offset = load * words;
      for (
        let source = findBit(importedIn, offset, words, 0);
        source !== -1 && nearest !== root;
        source = findBit(importedIn, offset, words, source + 1)
      ) {
        if (dominators[source] === -1) continue;
        nearest = nearest === -1 ? source : getShared(source, nearest);
      }
      if (dominators[load] === nearest) continue;
      dominators[load] = nearest;
      isSettled = false;
    }
  }
  return {
    dominators: dominators
      .subarray(0, count)
      .map((load) => (load === root ? -1 : load)),
    order,
  };
}

type Region = { hashes: string[]; demandIds: Set<number>; payerId: number };

/**
 * The regions of a graph, by their first hash: the messages that the same
 * loads pay for, see assignTranslationsByRegion. `demands` and `payers` hold
 * one row of loads for each id a region names.
 */
function findRegions(graph: RegionGraph) {
  const indexed = indexGraph(graph);
  const { ids, imports, dynamicImports, loads, loadOf, isEntry } = indexed;
  const words = getWords(loads.length);

  // The loads that reach each module, and those it is initialised with
  const reach = new Uint32Array(ids.length * words);
  const seen = new Int32Array(ids.length).fill(-1);
  loads.forEach((start, load) => {
    for (const module of getClosure(imports, start, seen, load)) {
      setBit(reach, module * words, load);
    }
  });
  const evaluated = graph.evaluated && new Uint32Array(ids.length * words);
  for (const [id, modules] of graph.evaluated ?? []) {
    const load = loadOf[indexed.indexes.get(id) ?? -1] ?? -1;
    if (load === -1) continue;
    for (const moduleId of modules) {
      const module = indexed.indexes.get(moduleId);
      if (module !== undefined) setBit(evaluated!, module * words, load);
    }
  }
  /** The loads a module runs in. */
  const getContexts = (module: number): Uint32Array => {
    const contexts = reach.slice(module * words, (module + 1) * words);
    if (evaluated) {
      for (let word = 0; word < words; word++) {
        contexts[word] |= evaluated[module * words + word];
      }
    }
    return contexts;
  };

  // The loads in which an import of each load point can run
  const importedIn = new Uint32Array(loads.length * words);
  dynamicImports.forEach((targets, module) => {
    if (!targets.length) return;
    const contexts = getContexts(module);
    for (const target of targets) {
      const offset = loadOf[target] * words;
      for (let word = 0; word < words; word++) {
        importedIn[offset + word] |= contexts[word];
      }
    }
  });
  const entryLoads = loads.flatMap((_module, load) =>
    isEntry[load] ? [load] : []
  );
  const { dominators, order } = findDominators(importedIn, words, isEntry);
  // The loads that can only run after each load
  const beneath = new Uint32Array(loads.length * words);
  for (let load = 0; load < loads.length; load++) {
    for (let above = dominators[load]; above !== -1; ) {
      setBit(beneath, above * words, load);
      above = dominators[above];
    }
  }

  // What demands each message: one row of loads per distinct set
  const demands: Uint32Array[] = [];
  const demandIds = new Map<string, number>();
  const getDemandId = (row: Uint32Array): number => {
    const key = String.fromCharCode(
      ...new Uint16Array(row.buffer, row.byteOffset, words * 2)
    );
    let id = demandIds.get(key);
    if (id === undefined) {
      id = demands.length;
      demands.push(row);
      demandIds.set(key, id);
    }
    return id;
  };
  // A message of one module has the module's row, which is not copied
  const demandOf = new Map<string, number | Uint32Array>();
  const addDemand = (hash: string, module: number) => {
    const known = demandOf.get(hash);
    if (known === undefined) {
      demandOf.set(hash, module);
      return;
    }
    const row =
      typeof known === 'number'
        ? reach.slice(known * words, (known + 1) * words)
        : known;
    for (let word = 0; word < words; word++) {
      row[word] |= reach[module * words + word];
    }
    demandOf.set(hash, row);
  };
  // The loads each message is initialised with, when the graph says
  const initialDemandOf = new Map<string, Uint32Array>();
  graph.modules.forEach((module, index) => {
    for (const hash of module.hashes) addDemand(hash, index);
    for (const hash of module.initialHashes ?? []) {
      addDemand(hash, index);
      if (!evaluated) continue;
      let row = initialDemandOf.get(hash);
      if (!row) initialDemandOf.set(hash, (row = new Uint32Array(words)));
      for (let word = 0; word < words; word++) {
        row[word] |= evaluated[index * words + word];
      }
    }
  });
  const everyEntry = new Uint32Array(words);
  for (const entry of entryLoads) setBit(everyEntry, 0, entry);
  const moduleDemandIds = new Int32Array(ids.length).fill(-1);
  const getHashDemandId = (demand: number | Uint32Array): number => {
    if (typeof demand !== 'number') {
      return getDemandId(
        demand.some((word) => word !== 0) ? demand : everyEntry
      );
    }
    if (moduleDemandIds[demand] === -1) {
      const row = reach.subarray(demand * words, (demand + 1) * words);
      moduleDemandIds[demand] = getDemandId(
        row.some((word) => word !== 0) ? row : everyEntry
      );
    }
    return moduleDemandIds[demand];
  };

  // What pays for each message: the loads that demand it and cannot only
  // run after another that does
  const payers: Uint32Array[] = [];
  const payerIds = new Map<string, number>();
  const payerIdOfDemand: number[] = [];
  // The loads that can only run after one that pays, by the same id
  const holders: Uint32Array[] = [];
  const getPayerId = (demandId: number): number => {
    if (payerIdOfDemand[demandId] !== undefined) {
      return payerIdOfDemand[demandId];
    }
    const demand = demands[demandId];
    const row = new Uint32Array(words);
    for (const load of getBits(demand, 0, words)) {
      let above = dominators[load];
      while (above !== -1 && !hasBit(demand, 0, above)) {
        above = dominators[above];
      }
      if (above === -1) setBit(row, 0, load);
    }
    const key = String.fromCharCode(...new Uint16Array(row.buffer));
    let id = payerIds.get(key);
    if (id === undefined) {
      id = payers.length;
      payers.push(row);
      payerIds.set(key, id);
      const holding = new Uint32Array(words);
      for (const load of getBits(row, 0, words)) {
        for (let word = 0; word < words; word++) {
          holding[word] |= beneath[load * words + word];
        }
      }
      holders.push(holding);
    }
    payerIdOfDemand[demandId] = id;
    return id;
  };

  const regionOfPayers = new Map<number, Region>();
  let conservativeMessages = 0;
  /** A message's demand with the loads it is initialised with. */
  const withInitialDemand = (
    hash: string,
    demand: number | Uint32Array
  ): number | Uint32Array => {
    const initial = initialDemandOf.get(hash);
    if (!initial) return demand;
    const row =
      typeof demand === 'number'
        ? reach.slice(demand * words, (demand + 1) * words)
        : demand;
    let isDemandedMore = false;
    for (let word = 0; word < words; word++) {
      if ((initial[word] & ~row[word]) !== 0) isDemandedMore = true;
      row[word] |= initial[word];
    }
    if (!isDemandedMore) return demand;
    conservativeMessages++;
    return row;
  };
  for (const [hash, reached] of demandOf) {
    const demandId = getHashDemandId(withInitialDemand(hash, reached));
    const payerId = getPayerId(demandId);
    let region = regionOfPayers.get(payerId);
    if (!region) {
      region = { hashes: [], demandIds: new Set(), payerId };
      regionOfPayers.set(payerId, region);
    }
    region.hashes.push(hash);
    region.demandIds.add(demandId);
  }
  const regions = [...regionOfPayers.values()];
  for (const region of regions) region.hashes.sort();
  regions.sort((a, b) => (a.hashes[0] < b.hashes[0] ? -1 : 1));
  return {
    indexed,
    words,
    regions,
    demands,
    payers,
    holders,
    entryLoads,
    dominators,
    order,
    getContexts,
    isConservative: evaluated !== undefined,
    conservativeMessages,
  };
}

/**
 * The regions assignTranslationsByRegion merges into files, for a report of
 * a build: the messages of each, and the load points that pay for it.
 */
export function listRegions(
  graph: RegionGraph
): { hashes: string[]; loads: string[] }[] {
  const { indexed, words, regions, payers } = findRegions(graph);
  return regions.map((region) => ({
    hashes: region.hashes,
    loads: getBits(payers[region.payerId], 0, words).map(
      (load) => indexed.ids[indexed.loads[load]]
    ),
  }));
}

/**
 * Assigns messages to files by the source modules each load can reach.
 *
 * - A load point is an entry or the module a dynamic import names. It
 *   demands the messages of that module and of every module it reaches
 *   through static imports. With `graph.evaluated` it also demands the
 *   `initialHashes` of every module that is initialised with it.
 * - A load can only run after the loads that every chain of dynamic imports
 *   from an entry to it passes through: the root an entry imports, a
 *   layout, the route that opens a dialog. What one of those demands is
 *   held when its own `import()` runs, so it does not fetch it. A load that
 *   several loads import can only run after those that all of them run
 *   after.
 * - A file is downloaded as often as the loads that fetch it load. A load
 *   loads once for itself and once for each time a load that can only run
 *   after it loads, unless `weights` says how often: so an entry weighs as
 *   much as all that its pages load, a root as much as its routes and their
 *   dialogs, and a route as much as its dialogs.
 * - A region is the messages that the same loads have to fetch. What an
 *   entry demands is one region, whatever else demands those messages.
 * - Regions are merged into files best pair first, see mergeRegions: a load
 *   downloads every file that holds something it demands, and a merge trades
 *   the bytes it wastes for the requests it saves, at `requestCost` bytes a
 *   request. What a load fetches also merges into a file the load holds,
 *   where it costs that load no request and everyone who fetches the file
 *   its bytes. An entry or a root is a load like any other, so files merge
 *   into theirs only when that pays for every load after them; `pinEntries`
 *   rules it out for the entries.
 * - With `previous`, each region starts in the file that held most of its
 *   bytes, and the regions of a file merge among themselves before anything
 *   else does. What still merges keeps its file and the file's key, so a
 *   small change to the sources moves few messages, and none when nothing
 *   changed.
 *
 * A message of a module that no load point reaches is held by every entry,
 * since the graph shows no later moment to load it.
 *
 * The lists of files come from what each load demands and from nothing the
 * merge decided, so every load holds its messages whatever the files are:
 * findUncoveredMessages checks that.
 */
export function assignTranslationsByRegion(
  graph: RegionGraph,
  options: RegionOptions
): RegionAssignment {
  const requestCost = options.requestCost ?? DEFAULT_REQUEST_COST;
  const estimateSize = options.estimateSize ?? estimateCompressedSize;
  const { sizes, previous } = options;
  const {
    indexed,
    words,
    regions,
    demands,
    payers,
    holders,
    entryLoads,
    dominators,
    order,
    getContexts,
    isConservative,
    conservativeMessages,
  } = findRegions(graph);
  const { ids, dynamicImports, loads, loadOf, isEntry, pages } = indexed;

  const getSize = (hash: string) => sizes.get(hash) ?? 0;
  const regionLoads = new Uint32Array(regions.length * words);
  const regionHolders = new Uint32Array(regions.length * words);
  const regionBytes = new Float64Array(regions.length);
  const classes = new Int32Array(regions.length);
  const groups = previous && new Int32Array(regions.length).fill(-1);
  const groupIds = new Map<string, number>();
  regions.forEach((region, index) => {
    const row = payers[region.payerId];
    regionLoads.set(row, index * words);
    regionHolders.set(holders[region.payerId], index * words);
    if (
      options.pinEntries &&
      entryLoads.some((entry) => hasBit(row, 0, entry))
    ) {
      classes[index] = 1;
    }
    const held = new Map<string, number>();
    for (const hash of region.hashes) {
      regionBytes[index] += getSize(hash);
      const key = previous?.get(hash);
      if (key !== undefined) {
        held.set(key, (held.get(key) ?? 0) + getSize(hash));
      }
    }
    let most: string | undefined;
    for (const [key, bytes] of held) {
      if (
        most === undefined ||
        bytes > held.get(most)! ||
        (bytes === held.get(most) && key < most)
      ) {
        most = key;
      }
    }
    if (most === undefined) return;
    if (!groupIds.has(most)) groupIds.set(most, groupIds.size);
    groups![index] = groupIds.get(most)!;
  });

  // A load loads once for itself and whenever a load that can only run after
  // it does
  const weights = new Float64Array(loads.length);
  const after = new Float64Array(loads.length);
  for (const load of order) {
    weights[load] = options.weights?.get(ids[loads[load]]) ?? 1 + after[load];
    if (dominators[load] !== -1) after[dominators[load]] += weights[load];
  }

  const merged = mergeRegions({
    loads: regionLoads,
    words,
    holders: regionHolders,
    weights,
    bytes: regionBytes,
    classes,
    groups,
    requestCost,
    estimateSize,
  });

  type Block = { hashes: string[]; demand: Uint32Array; key: string };
  const blockOfRegion = new Map<number, Block>();
  regions.forEach((region, index) => {
    let block = blockOfRegion.get(merged.blocks[index]);
    if (!block) {
      block = { hashes: [], demand: new Uint32Array(words), key: '' };
      blockOfRegion.set(merged.blocks[index], block);
    }
    for (const hash of region.hashes) block.hashes.push(hash);
    for (const demandId of region.demandIds) {
      for (let word = 0; word < words; word++) {
        block.demand[word] |= demands[demandId][word];
      }
    }
  });
  const blocks = [...blockOfRegion.values()];
  for (const block of blocks) block.hashes.sort();
  blocks.sort((a, b) => (a.hashes[0] < b.hashes[0] ? -1 : 1));
  nameBlocks(blocks, previous, getSize);
  blocks.sort((a, b) => (a.key < b.key ? -1 : 1));

  // The files that hold something each load demands
  const blockWords = getWords(blocks.length);
  const demanded = new Uint32Array(loads.length * blockWords);
  blocks.forEach((block, index) => {
    for (const load of getBits(block.demand, 0, words)) {
      setBit(demanded, load * blockWords, index);
    }
  });
  const getRow = (rows: Uint32Array, row: number) =>
    rows.subarray(row * blockWords, (row + 1) * blockWords);
  const intersectRows = (rows: Uint32Array[]): Uint32Array => {
    const all = rows[0].slice();
    for (const row of rows) {
      for (let word = 0; word < blockWords; word++) all[word] &= row[word];
    }
    return all;
  };
  const none = new Uint32Array(blockWords);
  /** The files the entries of every page of a load hold. */
  const heldOnPages = loads.map((_module, load) =>
    pages[load].length
      ? intersectRows(pages[load].map((entry) => getRow(demanded, entry)))
      : none
  );
  /** The files a page holds once a load has loaded. */
  const heldAfter = loads.map((_module, load) =>
    getRow(demanded, load).map((word, index) => word | heldOnPages[load][index])
  );
  const getKeys = (row: Uint32Array, held: Uint32Array): string[] =>
    getBits(
      row.map((word, index) => word & ~held[index]),
      0,
      blockWords
    ).map((index) => blocks[index].key);

  const startup = {
    startupMessages: 0,
    startupBytes: 0,
    entryMessages: 0,
    entryBytes: 0,
  };
  blocks.forEach((block, index) => {
    if (
      !entryLoads.some((entry) => hasBit(demanded, entry * blockWords, index))
    )
      return;
    startup.startupMessages += block.hashes.length;
    for (const hash of block.hashes) startup.startupBytes += getSize(hash);
  });
  regions.forEach((region, index) => {
    if (!entryLoads.some((entry) => hasBit(payers[region.payerId], 0, entry)))
      return;
    startup.entryMessages += region.hashes.length;
    startup.entryBytes += regionBytes[index];
  });

  const entries = new Map<string, string[]>();
  const imported = new Map<string, string[]>();
  const demandedByImport = new Map<string, string[]>();
  loads.forEach((module, load) => {
    const row = getRow(demanded, load);
    if (isEntry[load]) entries.set(ids[module], getKeys(row, none));
    if (indexed.isTarget[load]) {
      imported.set(ids[module], getKeys(row, heldOnPages[load]));
      demandedByImport.set(ids[module], getKeys(row, none));
    }
  });
  const importedBySite = new Map<string, string[]>();
  dynamicImports.forEach((targets, module) => {
    if (!targets.length) return;
    const contexts = getBits(getContexts(module), 0, words);
    const held = contexts.length
      ? intersectRows(contexts.map((load) => heldAfter[load]))
      : undefined;
    for (const target of targets) {
      importedBySite.set(
        `${ids[module]}\n${ids[target]}`,
        held
          ? getKeys(getRow(demanded, loadOf[target]), held)
          : imported.get(ids[target])!
      );
    }
  });

  return {
    entries,
    files: new Map(blocks.map((block) => [block.key, block.hashes])),
    imports: imported,
    getImportedFiles: (importer, target) =>
      importedBySite.get(`${importer}\n${target}`) ?? [],
    demands: demandedByImport,
    stats: {
      loads: loads.length,
      regions: regions.length,
      comparisons: merged.comparisons,
      isConservative,
      conservativeMessages,
      ...startup,
    },
  };
}

const MIN_KEY_LENGTH = 8;

/** How many uncovered messages findUncoveredMessages returns at most. */
export const MAX_UNCOVERED_MESSAGES = 1000;

/**
 * Gives each file its key. A file keeps the key of the previous file that
 * most of its bytes were in, which no other file took; a new file is named
 * by the start of its first hash, as short as no other key allows.
 */
function nameBlocks(
  blocks: { hashes: string[]; key: string }[],
  previous: ReadonlyMap<string, string> | undefined,
  getSize: (hash: string) => number
): void {
  const taken = new Set(previous?.values());
  const claims: { block: number; key: string; bytes: number; count: number }[] =
    [];
  blocks.forEach((block, index) => {
    const held = new Map<string, { bytes: number; count: number }>();
    for (const hash of block.hashes) {
      const key = previous?.get(hash);
      if (key === undefined) continue;
      const claim = held.get(key) ?? { bytes: 0, count: 0 };
      claim.bytes += getSize(hash);
      claim.count++;
      held.set(key, claim);
    }
    for (const [key, claim] of held)
      claims.push({ block: index, key, ...claim });
  });
  claims.sort(
    (a, b) =>
      b.bytes - a.bytes ||
      b.count - a.count ||
      (a.key < b.key ? -1 : a.key > b.key ? 1 : a.block - b.block)
  );
  const kept = new Set<string>();
  for (const { block, key } of claims) {
    if (blocks[block].key || kept.has(key)) continue;
    blocks[block].key = key;
    kept.add(key);
  }
  for (const block of blocks) {
    if (block.key) continue;
    const [first] = block.hashes;
    let key = first.slice(0, MIN_KEY_LENGTH);
    for (let length = key.length + 1; taken.has(key); length++) {
      key =
        length <= first.length
          ? first.slice(0, length)
          : `${first}-${length - first.length + 1}`;
    }
    block.key = key;
    taken.add(key);
  }
}

/**
 * Replays every load of a build against an assignment and returns each
 * message a load demands that no file it holds by then has. An assignment
 * from assignTranslationsByRegion for the same graph returns none.
 *
 * - An entry holds the files of `entries`.
 * - A dynamic import on a page that holds only its entry's files adds the
 *   files of `imports`.
 * - The import written in a module adds the files of `getImportedFiles`,
 *   in every load that runs the module: by then the page holds its entry's
 *   files and every file with a message that load demands.
 *
 * It stops at `limit` messages: an assignment for another graph can miss
 * millions.
 */
export function findUncoveredMessages(
  graph: RegionGraph,
  assignment: Pick<
    RegionAssignment,
    'entries' | 'files' | 'imports' | 'getImportedFiles'
  >,
  limit = MAX_UNCOVERED_MESSAGES
): UncoveredMessage[] {
  const {
    ids,
    indexes,
    imports,
    dynamicImports,
    loads,
    loadOf,
    isEntry,
    pages,
  } = indexGraph(graph);
  const keys = [...assignment.files.keys()];
  const blockOfKey = new Map(keys.map((key, index) => [key, index]));
  const blockOfHash = new Map<string, number>();
  keys.forEach((key, index) => {
    for (const hash of assignment.files.get(key)!) blockOfHash.set(hash, index);
  });
  const getHeld = (...lists: (string[] | undefined)[]): Uint8Array => {
    const held = new Uint8Array(keys.length);
    for (const key of lists.flat()) {
      const block = key === undefined ? undefined : blockOfKey.get(key);
      if (block !== undefined) held[block] = 1;
    }
    return held;
  };

  const evaluated = new Map<number, number[]>();
  for (const [id, modules] of graph.evaluated ?? []) {
    const load = loadOf[indexes.get(id) ?? -1] ?? -1;
    if (load === -1) continue;
    evaluated.set(
      load,
      modules.flatMap((module) => indexes.get(module) ?? [])
    );
  }
  const seen = new Int32Array(ids.length).fill(-1);
  let mark = 0;
  /**
   * Calls `visit` with each module a load runs, and whether the load demands
   * all of its messages or only those of its initialisation.
   */
  const visitLoad = (
    load: number,
    visit: (module: number, isReached: boolean) => void
  ) => {
    for (const module of getClosure(imports, loads[load], seen, mark++)) {
      visit(module, true);
    }
    for (const module of evaluated.get(load) ?? []) visit(module, false);
  };
  const getHashes = (module: number, isReached: boolean) => [
    ...(isReached ? graph.modules[module].hashes : []),
    ...(graph.modules[module].initialHashes ?? []),
  ];
  /** The files of some messages, with -1 when one of them is in no file. */
  const getBlocks = (hashes: string[]) => [
    ...new Set(hashes.map((hash) => blockOfHash.get(hash) ?? -1)),
  ];
  const reachedBlocks = ids.map((_id, module) =>
    getBlocks(getHashes(module, true))
  );
  const initialBlocks = ids.map((_id, module) =>
    getBlocks(getHashes(module, false))
  );

  const uncovered: UncoveredMessage[] = [];
  const reported = new Set<string>();
  const report = (load: number, hash: string, importer?: number) => {
    const key = `${load}\n${importer}\n${hash}`;
    if (uncovered.length >= limit || reported.has(key)) return;
    reported.add(key);
    uncovered.push({
      load: ids[loads[load]],
      ...(importer !== undefined && { importer: ids[importer] }),
      hash,
    });
  };

  // The files with a message each load demands, and the loads each module
  // with a dynamic import runs in
  const demanded = loads.map(() => new Uint8Array(keys.length));
  const contexts = new Map<number, number[]>();
  loads.forEach((_module, load) => {
    visitLoad(load, (module, isReached) => {
      for (const block of (isReached ? reachedBlocks : initialBlocks)[module]) {
        if (block !== -1) demanded[load][block] = 1;
        else {
          for (const hash of getHashes(module, isReached)) {
            if (!blockOfHash.has(hash)) report(load, hash);
          }
        }
      }
      if (!dynamicImports[module].length) return;
      const known = contexts.get(module);
      if (!known) contexts.set(module, [load]);
      else if (known[known.length - 1] !== load) known.push(load);
    });
  });

  /** Reports what a load demands from files that are in none of `held`. */
  const check = (load: number, held: Uint8Array[], importer?: number) => {
    if (uncovered.length >= limit) return;
    const isHeld = (block: number) => held.some((files) => files[block] === 1);
    if (demanded[load].every((value, block) => value === 0 || isHeld(block))) {
      return;
    }
    visitLoad(load, (module, isReached) => {
      for (const hash of getHashes(module, isReached)) {
        const block = blockOfHash.get(hash);
        if (block !== undefined && !isHeld(block)) report(load, hash, importer);
      }
    });
  };
  const heldByEntry = loads.map((module, load) =>
    isEntry[load] ? getHeld(assignment.entries.get(ids[module])) : undefined
  );

  loads.forEach((module, load) => {
    if (isEntry[load]) {
      check(load, [heldByEntry[load]!]);
      return;
    }
    const files = getHeld(assignment.imports.get(ids[module]));
    if (!pages[load].length) check(load, [files]);
    for (const entry of pages[load]) check(load, [files, heldByEntry[entry]!]);
  });
  for (const [importer, running] of contexts) {
    // What every page holds for certain when the importer runs
    const certain = new Uint8Array(keys.length).fill(1);
    for (const context of running) {
      const held = isEntry[context] ? heldByEntry[context]! : demanded[context];
      const entries = isEntry[context] ? [] : pages[context];
      for (let block = 0; block < keys.length; block++) {
        if (held[block] === 1) continue;
        if (
          !entries.length ||
          entries.some((entry) => heldByEntry[entry]![block] === 0)
        ) {
          certain[block] = 0;
        }
      }
    }
    for (const target of dynamicImports[importer]) {
      const files = getHeld(
        assignment.getImportedFiles(ids[importer], ids[target])
      );
      check(loadOf[target], [files, certain], importer);
    }
  }
  return uncovered;
}
