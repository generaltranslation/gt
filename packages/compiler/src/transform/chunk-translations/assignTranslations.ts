import path from 'node:path';
import type { ChunkImportMap } from './chunkImportMap';
import { IMPORTED_CHUNKS_PLACEHOLDER } from './resolveChunkTranslations';

/** A chunk the bundler wrote, with the messages its final code can render. */
export type AssignedChunk = {
  fileName: string;
  /** The hashes of the messages left in its code, see findChunkHashes */
  hashes: string[];
  /** The files of the chunks it imports statically */
  imports: string[];
  /** The files of the chunks it imports dynamically */
  dynamicImports: string[];
  isEntry: boolean;
};

/**
 * Which messages go into which translations file, and which files each place
 * that loads code must load with it. The files, the manifest, the startup
 * script and gt-react's loader are written from this alone, so the rule that
 * assigns messages can change without them.
 *
 * A file is named by its key: a path without an extension, to which the
 * build adds a locale and a hash (see renderChunkTranslations).
 */
export type TranslationAssignment = {
  /**
   * The hashes in the one file of each entry chunk, by the chunk's file. A
   * page requests it before any code runs.
   */
  entries: Map<string, string[]>;
  /** The hashes in every other file, by its key. */
  files: Map<string, string[]>;
  /**
   * The keys of the files a dynamic import of a chunk loads, by the chunk's
   * file, on a page that started from an entry.
   */
  imports: Map<string, string[]>;
  /**
   * The chunk import map of the build, when it has one: the lists a page is
   * sent then know an imported chunk by its names there too (see
   * renderImportedFiles).
   */
  importMap?: ChunkImportMap;
};

/**
 * A chunk that only other chunks import statically gets a file of its own
 * from this many messages on. With fewer, its messages are copied into the
 * file of each dynamically imported chunk that loads it, which costs less
 * than another request.
 */
export const MIN_SHARED_CHUNK_MESSAGES = 20;

// The `$_hash` option of a `t` template and the `_hash` prop of a <T>, as the
// compiler writes them; a change to that compiled shape (such as precomputed
// string messages) must extend this pattern, or those messages leave the files.
const HASH_ARGUMENT =
  /[{,]\s*["']?\$?_hash["']?\s*:\s*(["'`])([0-9a-f]{16})\1/g;

const CHUNK_EXTENSION = /\.[cm]?js$/;

/** The key of the file a chunk's messages go into: the chunk's file without its extension. */
export function getChunkKey(fileName: string): string {
  return fileName.replace(CHUNK_EXTENSION, '');
}

/**
 * The message hashes in a chunk's final code, sorted. A call site that was
 * tree-shaken or minified away took its hash with it, so only messages that
 * can render are found.
 */
export function findChunkHashes(
  code: string,
  hashes: ReadonlySet<string>
): string[] {
  const found = new Set<string>();
  for (const match of code.matchAll(HASH_ARGUMENT)) {
    if (hashes.has(match[2])) found.add(match[2]);
  }
  return [...found].sort();
}

/**
 * Assigns messages to files by the chunk they are in.
 *
 * - An entry chunk and everything it imports statically load before any
 *   code runs, so their messages share one file per entry.
 * - A dynamically imported chunk gets a file with its own messages and those
 *   of the small chunks it imports statically (see
 *   MIN_SHARED_CHUNK_MESSAGES).
 * - A larger chunk shared between dynamically imported chunks gets its own
 *   file, which each import that loads it lists.
 * - A message the entry's file already holds, on every page that can load a
 *   chunk, is left out of that chunk's file.
 *
 * Every chunk a page loads has its messages in a file that page loads first,
 * because a chunk only loads as part of an entry or of a dynamic import.
 * Whether a chunk gets a file, and what an import lists, depend only on the
 * chunks' code, never on the translations, so the code of a chunk stays the
 * same when translations change.
 */
export function assignTranslationsByChunk(
  bundle: readonly AssignedChunk[]
): TranslationAssignment {
  const byFile = new Map(bundle.map((chunk) => [chunk.fileName, chunk]));
  const getHashes = (file: string) => byFile.get(file)!.hashes;

  const closures = new Map<string, Set<string>>();
  /** A chunk with every chunk it imports statically, directly or not. */
  const getClosure = (fileName: string): Set<string> => {
    let closure = closures.get(fileName);
    if (!closure) {
      closure = new Set();
      const pending = [fileName];
      for (let file = pending.pop(); file; file = pending.pop()) {
        const chunk = byFile.get(file);
        if (!chunk || closure.has(file)) continue;
        closure.add(file);
        pending.push(...chunk.imports);
      }
      closures.set(fileName, closure);
    }
    return closure;
  };

  // What every page that can reach a chunk has loaded before it: the chunks
  // all of those pages' entries import statically.
  const loadedByEntries = new Map<string, Set<string>>();
  for (const entry of bundle) {
    if (!entry.isEntry) continue;
    const entryClosure = getClosure(entry.fileName);
    const reached = new Set<string>();
    const pending = [entry.fileName];
    for (let file = pending.pop(); file; file = pending.pop()) {
      const chunk = byFile.get(file);
      if (!chunk || reached.has(file)) continue;
      reached.add(file);
      pending.push(...chunk.imports, ...chunk.dynamicImports);
    }
    for (const file of reached) {
      const loaded = loadedByEntries.get(file);
      loadedByEntries.set(
        file,
        loaded
          ? new Set([...loaded].filter((other) => entryClosure.has(other)))
          : new Set(entryClosure)
      );
    }
  }
  const isLoadedByEntries = (file: string, other: string) =>
    loadedByEntries.get(file)?.has(other) ?? false;
  // The messages those chunks hold. Most chunks have the same ones loaded
  // before them, so the set is built once for each such group of chunks.
  const heldByLoaded = new Map<string, Set<string>>();
  const getHeld = (file: string): Set<string> => {
    const loaded = [...(loadedByEntries.get(file) ?? [])].sort();
    const key = loaded.join('\n');
    let held = heldByLoaded.get(key);
    if (!held) {
      held = new Set();
      for (const other of loaded) {
        for (const hash of getHashes(other)) held.add(hash);
      }
      heldByLoaded.set(key, held);
    }
    return held;
  };
  /** Those of `hashes` that the entry's file of some page reaching `file` lacks. */
  const withoutEntryMessages = (
    file: string,
    hashes: Iterable<string>
  ): string[] => {
    const held = getHeld(file);
    return [...new Set(hashes)].filter((hash) => !held.has(hash)).sort();
  };

  const hasOwnFile = (file: string) =>
    getHashes(file).length >= MIN_SHARED_CHUNK_MESSAGES;

  const targets = new Set(
    bundle.flatMap((chunk) =>
      chunk.dynamicImports.filter((file) => byFile.has(file))
    )
  );
  // By chunk file here, by key in the result
  const chunkFiles = new Map<string, string[]>();
  for (const target of targets) {
    const own = new Set(getHashes(target));
    for (const file of getClosure(target)) {
      if (file === target || isLoadedByEntries(target, file)) continue;
      if (!hasOwnFile(file)) {
        for (const hash of getHashes(file)) own.add(hash);
      } else if (!targets.has(file) && !chunkFiles.has(file)) {
        // Once for the chunk, not once for each import that loads it
        chunkFiles.set(file, withoutEntryMessages(file, getHashes(file)));
      }
    }
    chunkFiles.set(target, withoutEntryMessages(target, own));
  }
  for (const [file, hashes] of chunkFiles) {
    if (!hashes.length) chunkFiles.delete(file);
  }

  /** The files an import of `target` loads, leaving out what `isLoaded` has. */
  const listImportedFiles = (
    target: string,
    isLoaded: (file: string) => boolean
  ): string[] => {
    if (!byFile.has(target) || isLoaded(target)) return [];
    return [...getClosure(target)]
      .filter(
        (file) =>
          chunkFiles.has(file) &&
          (file === target || (hasOwnFile(file) && !isLoaded(file)))
      )
      .map(getChunkKey)
      .sort();
  };

  const imports = new Map<string, string[]>();
  for (const target of targets) {
    imports.set(
      target,
      listImportedFiles(target, (file) => isLoadedByEntries(target, file))
    );
  }

  const entries = new Map<string, string[]>();
  for (const entry of bundle) {
    if (!entry.isEntry) continue;
    const own = new Set<string>();
    for (const file of getClosure(entry.fileName)) {
      for (const hash of getHashes(file)) own.add(hash);
    }
    entries.set(entry.fileName, [...own].sort());
  }

  return {
    entries,
    files: new Map(
      [...chunkFiles].map(([file, hashes]) => [getChunkKey(file), hashes])
    ),
    imports,
  };
}

/** A message a load runs the call site of and requests no file for. */
export type UncoveredChunkMessage = {
  hash: string;
  /** The chunk whose code holds the call site */
  chunk: string;
  /** The entry chunk, or the dynamically imported one, whose load runs it */
  load: string;
};

/** How many uncovered messages findUncoveredChunkMessages returns at most. */
export const MAX_UNCOVERED_CHUNK_MESSAGES = 100;

/**
 * Replays every load of a build against the files the build is about to
 * write, whatever rule assigned them: a load is an entry, or a dynamic
 * import of a chunk on a page that started from an entry that can reach it.
 *
 * - A load runs its chunk and every chunk that one imports statically.
 * - All a page is certain to hold when a dynamic import runs is the file of
 *   the entry it started from, since no other import has to have run first.
 *   The import adds the files `lists` names for its chunk, which are the
 *   lists the page is sent, read as gt-react reads them: what the assignment
 *   meant to list counts for nothing.
 *
 * Returns the messages of a chunk a load runs that none of those files
 * holds, which would render their source with nothing said. A build fails on
 * any.
 */
export function findUncoveredChunkMessages(
  bundle: readonly AssignedChunk[],
  assignment: Pick<TranslationAssignment, 'entries' | 'files'>,
  lists: ImportedFiles | undefined
): UncoveredChunkMessage[] {
  const byFile = new Map(bundle.map((chunk) => [chunk.fileName, chunk]));
  const reach = (
    start: string,
    follow: (chunk: AssignedChunk) => readonly string[]
  ): AssignedChunk[] => {
    const reached = new Map<string, AssignedChunk>();
    const pending = [start];
    for (let file = pending.pop(); file; file = pending.pop()) {
      const chunk = byFile.get(file);
      if (!chunk || reached.has(file)) continue;
      reached.set(file, chunk);
      pending.push(...follow(chunk));
    }
    return [...reached.values()];
  };
  const uncovered: UncoveredChunkMessage[] = [];
  const check = (load: string, held: ReadonlySet<string>): void => {
    for (const chunk of reach(load, ({ imports }) => imports)) {
      for (const hash of chunk.hashes) {
        if (
          !held.has(hash) &&
          uncovered.length < MAX_UNCOVERED_CHUNK_MESSAGES
        ) {
          uncovered.push({ hash, chunk: chunk.fileName, load });
        }
      }
    }
  };

  const hold = (held: Set<string>, target: string): Set<string> => {
    for (const key of readImportedFiles(lists, target) ?? []) {
      for (const hash of assignment.files.get(key) ?? []) held.add(hash);
    }
    return held;
  };

  const targets = new Set(bundle.flatMap((chunk) => chunk.dynamicImports));
  const started = new Set<string>();
  for (const entry of bundle) {
    if (!entry.isEntry) continue;
    const heldByEntry = assignment.entries.get(entry.fileName) ?? [];
    check(entry.fileName, new Set(heldByEntry));
    for (const { fileName } of reach(entry.fileName, (chunk) => [
      ...chunk.imports,
      ...chunk.dynamicImports,
    ])) {
      if (!targets.has(fileName)) continue;
      started.add(fileName);
      check(fileName, hold(new Set(heldByEntry), fileName));
    }
  }
  // A chunk no entry leads to is imported on a page that holds nothing
  for (const target of targets) {
    if (started.has(target) || !byFile.has(target)) continue;
    check(target, hold(new Set(), target));
  }
  return uncovered;
}

/**
 * The keys of the files the import of a chunk needs, read from the lists a
 * page is sent as gt-react's `listImportedFiles()` reads them. Undefined when
 * the lists do not know the chunk, as they do not when its import needs none.
 */
export function readImportedFiles(
  lists: ImportedFiles | undefined,
  chunk: string
): string[] | undefined {
  if (!lists) return [];
  const place = lists.k.indexOf(getChunkKey(chunk));
  if (place < 0) return undefined;
  const needed = lists.c[place] || [];
  const files = needed[0] ? [lists.k[place]] : [];
  for (let pair = 1; pair < needed.length; pair += 2) {
    for (let next = 0; next < needed[pair + 1]; next++) {
      files.push(lists.k[needed[pair] + next]);
    }
  }
  return files;
}

/**
 * The files each dynamic import needs, as the entry's file of every locale
 * holds them and gt-react's `listImportedFiles()` reads them. Compiled code
 * names only the chunk it imports, so no page downloads these lists with its
 * JavaScript, and a page in the default locale never does. In a build that
 * names each file by its own hash, the locale's map holds them instead, with
 * those hashes (see renderMappedFiles).
 */
export type ImportedFiles = {
  /**
   * The keys of those files and of the imported chunks: the ones most
   * imports need first, so each import's are few runs of neighbours.
   */
  k: string[];
  /**
   * For the chunk whose key is at the same place in `k`, 0 when its import
   * needs no file: whether it needs the file of that key, then the other
   * files it needs, as places in `k` in pairs of the first and how many
   * follow on from it.
   */
  c: (number[] | 0)[];
  /**
   * In a locale's map: the hash in the name of the file whose key is at the
   * same place in `k`, 0 when the locale has no such file.
   */
  h?: (string | 0)[];
};

/**
 * `imports` with each chunk also under every name the chunk import map has
 * for it. gt-react finds an import's files by what the importing chunk's
 * code says of the imported one, which with an import map is its name: the
 * code of a chunk cannot hold the file of another, or it would change with
 * that chunk's content while the name of its own file stays.
 */
export function addChunkNames<Keys>(
  imports: ReadonlyMap<string, Keys>,
  importMap: ChunkImportMap | undefined
): Map<string, Keys> {
  const named = new Map(imports);
  for (const [name, file] of importMap ?? []) {
    const keys = imports.get(file);
    if (keys !== undefined && !named.has(name)) named.set(name, keys);
  }
  return named;
}

/**
 * Undefined when no import needs a file. A chunk whose import needs none is
 * in no list, which is how gt-react finds nothing to request for it.
 *
 * With a chunk import map, a chunk is listed under its file, as a page
 * preloads it, and under its names, as a page imports it: see addChunkNames.
 */
export function renderImportedFiles(
  imports: ReadonlyMap<string, readonly string[]>,
  importMap?: ChunkImportMap
): ImportedFiles | undefined {
  const uses = new Map<string, number>();
  const needs: [string, readonly string[]][] = [];
  for (const [target, keys] of addChunkNames(imports, importMap)) {
    if (!keys.length) continue;
    const own = getChunkKey(target);
    needs.push([own, keys]);
    for (const key of keys) {
      if (key !== own) uses.set(key, (uses.get(key) ?? 0) + 1);
    }
  }
  if (!needs.length) return undefined;
  const k = [...new Set([...uses.keys(), ...needs.map(([own]) => own)])].sort(
    (a, b) =>
      (uses.get(b) ?? 0) - (uses.get(a) ?? 0) || (a < b ? -1 : a > b ? 1 : 0)
  );
  const places = new Map(k.map((key, place) => [key, place]));
  const c: (number[] | 0)[] = k.map(() => 0);
  for (const [own, keys] of needs) {
    const others = keys
      .filter((key) => key !== own)
      .map((key) => places.get(key)!)
      .sort((a, b) => a - b);
    const needed = [keys.length > others.length ? 1 : 0];
    for (let first = 0; first < others.length; ) {
      let last = first;
      while (others[last + 1] === others[last] + 1) last++;
      needed.push(others[first], last - first + 1);
      first = last + 1;
    }
    c[places.get(own)!] = needed;
  }
  while (c[c.length - 1] === 0) c.pop();
  return { k, c };
}

/**
 * A locale's map, in a build that names each file by its own hash: the files
 * each dynamic import needs and the hash in the name of every file, by its
 * key. Everything that names a chunk is here, so no other file of the locale
 * changes when only the names of chunks do. Undefined when the locale has no
 * file and no import needs one.
 *
 * @param hashes The hash in the name of each of the locale's files, by its key.
 */
export function renderMappedFiles(
  imported: ImportedFiles | undefined,
  hashes: Readonly<Record<string, string>>
): ImportedFiles | undefined {
  const listed = new Set(imported?.k);
  // A file no import lists is one a page requests for a chunk it loads itself
  const k = [
    ...(imported?.k ?? []),
    ...Object.keys(hashes)
      .filter((key) => !listed.has(key))
      .sort(),
  ];
  if (!k.length) return undefined;
  const h: (string | 0)[] = k.map((key) => hashes[key] ?? 0);
  while (h[h.length - 1] === 0) h.pop();
  return { k, c: imported?.c ?? [], h };
}

// What Vite writes after a dynamic import: the chunks to preload with it,
// as its marker and then as the list it puts there, and where they are
// relative to.
const VITE_PRELOADED =
  '(?:__VITE_PRELOAD__|__vite__mapDeps\\(\\[[\\d,\\s]*\\]\\)|void 0|\\[\\])\\s*(?:,\\s*[\\w$.]+\\s*)?';

// What a bundler may write after an import in the function that makes it,
// as `.then((n) => n.namespace)` for a chunk whose exports are not the
// module's: no string, and brackets that close, so it ends inside that
// function.
const AFTER_IMPORT = `(?:[^()"'\`]|\\((?:[^()"'\`]|\\((?:[^()"'\`]|\\([^()"'\`]*\\))*\\))*\\))*?`;

// The compiler's `() => import('./Home'), "<placeholder>"` once Vite has
// wrapped the import in its preload call, as a bundler prints it before it
// minifies.
const PRELOADED_IMPORT = new RegExp(
  `\\(\\s*\\)\\s*=>\\s*(__vitePreload[\\w$]*)\\(\\s*(\\(\\s*\\)\\s*=>\\s*import\\(\\s*(["'\`])[^"'\`]+\\3\\s*\\)${AFTER_IMPORT})\\s*,\\s*(${VITE_PRELOADED})\\)\\s*,\\s*((["'\`])${IMPORTED_CHUNKS_PLACEHOLDER}\\6)`,
  'g'
);

/**
 * Hands Vite's preload call of each wrapped dynamic import to gt-react, in a
 * chunk the bundler has rendered and not yet minified:
 * `load(() => __vitePreload(() => import('./Home'), deps), "<placeholder>")`
 * becomes `load(() => import('./Home'), "<placeholder>", __vitePreload, deps)`.
 * gt-react makes the same call, with an `import()` that waits for the
 * translations: Vite's links for the chunk, its static imports and its styles
 * are added at once, so they download while the translations do.
 *
 * An import without that call is left as it is: gt-react preloads its chunk.
 */
export function passPreloads(code: string): string {
  if (!code.includes(IMPORTED_CHUNKS_PLACEHOLDER)) return code;
  return code.replace(
    PRELOADED_IMPORT,
    (
      _match,
      preload: string,
      start: string,
      _quote: string,
      preloaded: string,
      placeholder: string
    ) => `${start}, ${placeholder}, ${preload}, ${preloaded}`
  );
}

// A wrapped dynamic import in a chunk's final code: the import, the
// placeholder, and from Vite its preload call and the first chunk it lists.
// Where passPreloads could not take Vite's call out of the function, the
// import is still inside it, with the call's other arguments after it.
const WRAPPED_IMPORT = new RegExp(
  `(import\\(\\s*(["'\`])([^"'\`]+)\\2\\s*\\)${AFTER_IMPORT}(?:,\\s*${VITE_PRELOADED}\\)\\s*)?,\\s*)(["'\`])${IMPORTED_CHUNKS_PLACEHOLDER}\\4(\\s*,\\s*[\\w$.]+\\s*,\\s*__vite__mapDeps\\(\\[\\s*(\\d+))?`,
  'g'
);

/**
 * What a dynamic import in a chunk of `directory` names, and the file of the
 * chunk it loads: the same without an import map.
 */
function resolveImportedChunk(
  directory: string,
  specifier: string,
  importMap: ChunkImportMap | undefined
): { name: string; file: string } {
  const joined = path.posix.join(directory, specifier);
  // A specifier that is not a path is a name as it is written
  const name =
    importMap?.has(specifier) && !importMap.has(joined) ? specifier : joined;
  return { name, file: importMap?.get(name) ?? name };
}

/**
 * The files of the chunks that the wrapped dynamic imports in a chunk's
 * final code load, read from the code itself. That is what a page imports,
 * whatever the bundler reports as the chunk's dynamic imports: an import can
 * load a chunk that only passes another chunk's exports on.
 * @param importMap The chunk import map of the build, when it has one.
 */
export function findImportedChunks(
  chunk: { fileName: string; code: string },
  importMap?: ChunkImportMap
): string[] {
  if (!chunk.code.includes(IMPORTED_CHUNKS_PLACEHOLDER)) return [];
  const directory = path.posix.dirname(chunk.fileName);
  return [
    ...new Set(
      [...chunk.code.matchAll(WRAPPED_IMPORT)].map(
        (match) => resolveImportedChunk(directory, match[3], importMap).file
      )
    ),
  ];
}

const PLACEHOLDER = new RegExp(
  `(["'\`])${IMPORTED_CHUNKS_PLACEHOLDER}\\1`,
  'g'
);

// The chunks Vite's lists name by their place, at the top of a chunk
const PRELOADED_CHUNKS = /\bm\.f\s*=\s*(\[[^\]]*\])/;

/**
 * Replaces the placeholder of each wrapped dynamic import in a chunk's final
 * code with what gt-react finds the import's files by: the file of the
 * imported chunk, or 0 when gt-react can read it from the import itself.
 * That is when the import needs no file, and when the first chunk Vite
 * lists for it is that file, which is so unless the build changes those
 * lists. So an import costs a page no more than Vite's own.
 *
 * Runs after Vite has written its lists. The import is read from the code
 * itself, where it names the chunk the bundler wrote. In a build with a
 * chunk import map the code and Vite's lists hold the chunk's name there,
 * and so does what replaces the placeholder: see addChunkNames.
 *
 * A wrapped import the code shows no chunk for gets 0 and runs without
 * waiting. Where the bundler put the imported module into a chunk the page
 * has, that is right: the function holds no import any more. `unread` counts
 * the others, whose function still imports a chunk in a form this does not
 * read. See findUngatedImports.
 *
 * @param needsFiles Whether the import of a chunk needs any file.
 * @param importMap The chunk import map of the build, when it has one.
 */
export function replaceImportedChunks(
  chunk: { fileName: string; code: string },
  needsFiles: (target: string) => boolean,
  importMap?: ChunkImportMap
): { code: string; unread: number } {
  if (!chunk.code.includes(IMPORTED_CHUNKS_PLACEHOLDER)) {
    return { code: chunk.code, unread: 0 };
  }
  const directory = path.posix.dirname(chunk.fileName);
  let preloaded: unknown[] = [];
  try {
    preloaded = JSON.parse(PRELOADED_CHUNKS.exec(chunk.code)?.[1] ?? '[]');
  } catch {
    // Not a list of file names: every import names its chunk
  }
  const read = chunk.code.replace(
    WRAPPED_IMPORT,
    (
      _match,
      before: string,
      _quote: string,
      specifier: string,
      _placeholderQuote: string,
      after = '',
      first?: string
    ) => {
      const { name, file } = resolveImportedChunk(
        directory,
        specifier,
        importMap
      );
      const listed = first !== undefined && preloaded[Number(first)] === name;
      return `${before}${listed || !needsFiles(file) ? '0' : JSON.stringify(name)}${after}`;
    }
  );
  return {
    code: read.replace(PLACEHOLDER, '0'),
    unread: [...read.matchAll(PLACEHOLDER)].filter(({ index }) =>
      importsChunk(read, index)
    ).length,
  };
}

/**
 * Whether the function a wrapped import is in, which ends before the
 * placeholder at `end`, still holds an `import()`.
 */
function importsChunk(code: string, end: number): boolean {
  let depth = 0;
  for (let at = end - 1; at >= 0; at--) {
    if (code[at] === ')') depth++;
    else if (code[at] === '(' && depth-- === 0) {
      return /\bimport\s*\(/.test(code.slice(at, end));
    }
  }
  return false;
}

/** The dynamic imports of a chunk that load translations nothing waits for. */
export type UngatedImports = {
  /** The file of the chunk the imports are in */
  chunk: string;
  /** The files of the chunks they load */
  targets: string[];
};

/**
 * The dynamic imports of a chunk that load a chunk with translation files
 * while no wrapped import in its code asks for them, so the chunk would run
 * before its translations and render their source with nothing said.
 *
 * A bundler can list the chunk itself, for an import of one of its own
 * modules: that import loads nothing.
 *
 * @param gates The chunks its wrapped imports load, see findImportedChunks.
 * @param needsFiles Whether the import of a chunk needs any file.
 * @param isLoadedWith Whether loading the first chunk loads the second, as one it imports statically.
 */
export function findUngatedImports(
  chunk: { fileName: string; dynamicImports?: readonly string[] },
  gates: readonly string[],
  needsFiles: (target: string) => boolean,
  isLoadedWith: (gate: string, target: string) => boolean
): UngatedImports | undefined {
  const targets = (chunk.dynamicImports ?? []).filter(
    (target) =>
      target !== chunk.fileName &&
      needsFiles(target) &&
      !gates.some((gate) => gate === target || isLoadedWith(gate, target))
  );
  return targets.length ? { chunk: chunk.fileName, targets } : undefined;
}
