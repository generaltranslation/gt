import { createHash } from 'node:crypto';
import type { MessageTree } from '@generaltranslation/icu';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import type { TranslationsTable } from './loadTranslationFiles';

/**
 * A build with chunk translations writes both sides of a lookup: what a
 * compiled call site passes, and the key of that message in the file the
 * call site reads. A hash is random, so it does not compress, and it is most
 * of what a message costs a page beyond its text. Hash minification writes
 * an id in place of the hash at both sides, and the runtime looks one up
 * under the other as it does a hash.
 *
 * An id is what names the list of its chunk's messages, then the place of
 * its message in that list, as `kR3_x0Qa.12`. The list is the hashes of the
 * messages in the chunk's code, in the order of the hashes, and its name is
 * a digest of exactly that. So an id still follows from content alone, as a
 * hash does: the same id names the same message in every build, no build
 * needs a table from another, and a page can read a file of any build. What
 * it costs a page is one digest per chunk, which every call site of the
 * chunk repeats, and a small number.
 *
 * A chunk's messages are known once the bundler has put its modules
 * together, so a module is compiled with a placeholder at each call site,
 * and the chunk's hashes are minified when it is rendered, before the
 * bundler minifies and names it. Its ids change when the set of its own
 * messages does, and with nothing else: not with the order of its modules
 * or of its code.
 *
 * A message that two chunks read has an id in each. The hash itself stays
 * what it is everywhere else: in the catalogs, in the unsplit file, at every
 * call site the runtime hashes, and inside this build, which reads ids back
 * into hashes before it assigns messages to files.
 *
 * A file of such a build holds no id written out, and each of its
 * translations once, however many ids read it (see MinifiedTranslations).
 *
 * A hash is read here as a string and nothing more: its length and its
 * characters are never looked at. What tells an id from a hash, whatever a
 * hash is made of, is the separator before the number, which is no
 * character of hexadecimal or of base64url. No property that every object
 * has holds one either.
 */

/**
 * Written before the hash at a call site the build splits, in a module's
 * code, and replaced with the id once the module's chunk is rendered.
 */
export const MINIFIED_ID_PLACEHOLDER = '__GT_CHUNK_TRANSLATIONS_ID__';

/** The characters that name a chunk's list of messages: 48 bits of its digest. */
export const MINIFIED_ID_LIST_LENGTH = 8;

/** Between the name of a list and the place in it: a character no hash has. */
export const MINIFIED_ID_SEPARATOR = '.';

/** The ids of a build with hash minification: the hash of each id a chunk was given. */
export type MinifiedIds = { hashes: Map<string, string> };

/**
 * What a translations file of a build with hash minification holds, in
 * place of one entry per id: its translations, each once, and for the list
 * of each chunk that reads some of them, runs of three numbers. A run is a
 * place in the list, the place of its translation in the file, and how many
 * places follow on from both: `[12, 0, 2]` under `kR3_x0Qa` gives
 * `kR3_x0Qa.12` the file's first translation and `kR3_x0Qa.13` its second.
 * gt-react's `register()` reads a file back into an entry per id, each of
 * which holds the one translation.
 */
export type MinifiedTranslations = [
  translations: unknown[],
  lists: Record<string, number[]>,
];

/** How such a build reads the ids back out of code, once its chunks are rendered. */
export type MinifiedIdReader = {
  /** Matches what a compiled call site passes, in the code */
  argument: RegExp;
  /** The hash of each id a call site of the build can pass */
  hashes: ReadonlyMap<string, string>;
};

/**
 * What a build with hash minification knows of the call sites that hash
 * their message when they run, and so read it by hash.
 */
export type RuntimeReaders = {
  /** The hashes of the compiled `t` templates of each shape */
  compiled: Map<string, Set<string>>;
  /** The shapes of the messages such call sites can read */
  shapes: Set<string>;
  /** The modules with such a call site of which nothing says what it reads */
  unknown: Set<string>;
};

/**
 * What two trees share when they differ only in the names of their
 * variables: a template builds the same text, branches and formats whatever
 * its values turn out to be, but names a value by what it is when it runs.
 */
export function getMessageShape(tree: MessageTree): string {
  return JSON.stringify(blankNames(tree));
}

function blankNames(tree: MessageTree): unknown {
  if (typeof tree === 'string') return tree;
  return tree.map((node) => {
    if (!Array.isArray(node)) return node;
    const [, kind, detail, ...rest] = node as readonly unknown[];
    if (kind === 'select' || kind === 'plural' || kind === 'selectordinal') {
      const branches = Object.entries(detail as Record<string, MessageTree>);
      return [
        '',
        kind,
        Object.fromEntries(
          branches.map(([key, branch]) => [key, blankNames(branch)])
        ),
        ...rest,
      ];
    }
    if (kind === 'tag') return ['', kind, blankNames(detail as MessageTree)];
    return ['', ...node.slice(1)];
  });
}

// A hash is whatever follows the placeholder, up to the end of its string
const WRITTEN_HASH = '([^"\'`\\\\]+)';

const PLACEHOLDER = new RegExp(
  `(["'\`])${MINIFIED_ID_PLACEHOLDER}${WRITTEN_HASH}\\1`,
  'g'
);

// The id of a call site in a chunk's final code, see HASH_ARGUMENT in
// assignTranslations.ts
const ID_ARGUMENT = new RegExp(
  `[{,]\\s*["']?\\$?_hash["']?\\s*:\\s*(["'\`])([A-Za-z0-9_-]{${MINIFIED_ID_LIST_LENGTH}}\\${MINIFIED_ID_SEPARATOR}\\d+)\\1`,
  'g'
);

// The placeholder of a call site in the code of a module
const PLACEHOLDER_ARGUMENT = new RegExp(
  `[{,]\\s*["']?\\$?_hash["']?\\s*:\\s*(["'\`])${MINIFIED_ID_PLACEHOLDER}${WRITTEN_HASH}\\1`,
  'g'
);

// How many modules, chunks or ids a diagnostic names
const MAX_NAMED = 5;

const nameSome = (names: string[]) => [
  ...names.slice(0, MAX_NAMED),
  ...(names.length > MAX_NAMED ? [`and ${names.length - MAX_NAMED} more`] : []),
];

export const MINIFY_HASHES_WITHOUT_CHUNK_TRANSLATIONS_ERROR =
  createDiagnosticMessage({
    source: '@generaltranslation/compiler',
    severity: 'Error',
    whatHappened:
      'experimentalChunkTranslationsMinifyHashes is set in a build without experimentalChunkTranslations',
    why: 'hash minification replaces the key of a message in the translation files that only such a build writes',
    fix: 'Turn experimentalChunkTranslations on, or turn experimentalChunkTranslationsMinifyHashes off',
  });

export const MINIFY_HASHES_WITH_TAGGED_IDS_ERROR = createDiagnosticMessage({
  source: '@generaltranslation/compiler',
  severity: 'Error',
  whatHappened:
    'experimentalChunkTranslationsMinifyHashes cannot be used with _tagIds',
  why: 'a <T> then writes what its call site passes into data-_gt-hash, where tools read the hash of the message',
  fix: 'Remove _tagIds from gt.config.json, or turn experimentalChunkTranslationsMinifyHashes off',
});

export const createRuntimeHashesWarning = (files: string[]) =>
  createDiagnosticMessage({
    source: '@generaltranslation/compiler',
    severity: 'Warning',
    whatHappened: `Hash minification cannot tell which messages ${files.length === 1 ? 'a module reads' : `${files.length} modules read`} by a hash computed when the app runs`,
    why: 'a call site there builds its message from derive() or from parts that are not written at the call',
    reassurance:
      'Such a call site finds its translation in the unsplit file, unless a <T> or t template that the build compiled reads the same message, which then renders its source text there',
    fix: 'Write the message the same way at each call site, or turn experimentalChunkTranslationsMinifyHashes off',
    details: nameSome(files),
  });

export const createSharedListNameError = (
  id: string,
  hashes: [string, string]
) =>
  createDiagnosticMessage({
    source: '@generaltranslation/compiler',
    severity: 'Error',
    whatHappened: `Hash minification gives two messages the id "${id}"`,
    why: 'the lists of messages of two chunks have the same digest, and a page would render the translation of one message for the other',
    fix: 'Turn experimentalChunkTranslationsMinifyHashes off',
    details: `${hashes[0]} and ${hashes[1]}`,
  });

export const createTakenIdError = (ids: string[]) =>
  createDiagnosticMessage({
    source: '@generaltranslation/compiler',
    severity: 'Error',
    whatHappened: `Hash minification gives ${ids.length === 1 ? 'a message an id' : `${ids.length} messages ids`} that the translations already hold`,
    why: 'a key of the translation files, or an id written by hand, is the same string, and a page would render one message for the other',
    fix: 'Turn experimentalChunkTranslationsMinifyHashes off',
    details: nameSome(ids),
  });

export const createUnminifiedChunksError = (files: string[]) =>
  createDiagnosticMessage({
    source: '@generaltranslation/compiler',
    severity: 'Error',
    whatHappened: `Hash minification did not reach the call sites of ${files.length === 1 ? 'a chunk' : `${files.length} chunks`}`,
    why: 'the bundler wrote them without rendering them through this plugin, so their call sites still hold a placeholder and would render the source text',
    fix: 'Turn experimentalChunkTranslationsMinifyHashes off',
    details: nameSome(files),
  });

/** What the compiler writes at a call site whose chunk is rendered later. */
export function createIdPlaceholder(hash: string): string {
  return `${MINIFIED_ID_PLACEHOLDER}${hash}`;
}

/** What names a list of messages: the start of a digest of their hashes, in the order given. */
export function getListName(hashes: readonly string[]): string {
  return createHash('sha256')
    .update(JSON.stringify(hashes))
    .digest('base64url')
    .slice(0, MINIFIED_ID_LIST_LENGTH);
}

/**
 * The id of each of a chunk's messages, by its hash: the messages are
 * listed in the order of their hashes, wherever the chunk's code names them.
 */
export function minifyHashes(hashes: Iterable<string>): Map<string, string> {
  const list = [...new Set(hashes)].sort();
  const name = getListName(list);
  return new Map(
    list.map((hash, place) => [hash, `${name}${MINIFIED_ID_SEPARATOR}${place}`])
  );
}

/**
 * Minifies the hashes of a chunk the bundler has rendered: each placeholder
 * becomes the id of its message, and `minified` learns the hash of each id.
 * Undefined when the chunk holds no placeholder.
 *
 * Throws when an id already names another message: two different lists
 * share a digest, which chance does once in 2^48 pairs of them.
 */
export function minifyChunk(
  code: string,
  minified: MinifiedIds
): string | undefined {
  if (!code.includes(MINIFIED_ID_PLACEHOLDER)) return undefined;
  const ids = minifyHashes(
    [...code.matchAll(PLACEHOLDER)].map((match) => match[2])
  );
  if (!ids.size) return undefined;
  for (const [hash, id] of ids) {
    const named = minified.hashes.get(id);
    if (named !== undefined && named !== hash) {
      throw new Error(createSharedListNameError(id, [named, hash]));
    }
    minified.hashes.set(id, hash);
  }
  return code.replace(
    PLACEHOLDER,
    (_match, quote: string, hash: string) => `${quote}${ids.get(hash)}${quote}`
  );
}

/**
 * How a build with hash minification reads its chunks, once all of them are
 * rendered. Throws when an id is also a key of the translations that names
 * something else, so that no page ever renders one message's translation
 * for another, and when a chunk still holds a placeholder.
 */
export function readMinifiedIds(
  minified: MinifiedIds,
  build: { unsplit: ReadonlySet<string> },
  table: TranslationsTable,
  chunks: readonly { fileName: string; code: string }[]
): MinifiedIdReader {
  const unminified = chunks
    .filter(({ code }) => code.includes(MINIFIED_ID_PLACEHOLDER))
    .map(({ fileName }) => fileName);
  if (unminified.length) {
    throw new Error(createUnminifiedChunksError(unminified.sort()));
  }
  const taken = [...minified.hashes.keys()].filter(
    (id) =>
      build.unsplit.has(id) ||
      Object.values(table).some((translations) =>
        Object.prototype.hasOwnProperty.call(translations, id)
      )
  );
  if (taken.length) throw new Error(createTakenIdError(taken.sort()));
  return { argument: ID_ARGUMENT, hashes: minified.hashes };
}

/**
 * How such a build reads the code of a module, which the bundler keeps as
 * it was before its chunk was rendered: each placeholder is its hash.
 */
export function readPlaceholders(
  hashes: ReadonlySet<string>
): MinifiedIdReader {
  return {
    argument: PLACEHOLDER_ARGUMENT,
    hashes: new Map([...hashes].map((hash) => [hash, hash])),
  };
}

/**
 * The ids in a chunk's final code, in the order of their lists and numbers.
 * A call site that was tree-shaken or minified away took its id with it.
 */
export function findChunkIds(code: string, ids: MinifiedIdReader): string[] {
  const found = new Set<string>();
  for (const match of code.matchAll(ids.argument)) {
    if (ids.hashes.has(match[2])) found.add(match[2]);
  }
  return sortIds([...found]);
}

/** The name of the list an id is of, and its place in that list. */
function readId(id: string): [name: string, place: number] {
  const end = id.lastIndexOf(MINIFIED_ID_SEPARATOR);
  return [id.slice(0, end), Number(id.slice(end + 1))];
}

/** Ids by their list, then by their number, as a file holds them. */
export function sortIds(ids: string[]): string[] {
  return ids.sort((a, b) => {
    const [first, place] = readId(a);
    const [second, otherPlace] = readId(b);
    return first === second ? place - otherPlace : first < second ? -1 : 1;
  });
}

/**
 * The translations of `ids` that `locale` has, as a file of a build with
 * hash minification holds them: a translation is in the file once, also
 * when several ids read it, as those of a message that several chunks read
 * do, and two messages with one translation.
 */
export function pickMinifiedTranslations(
  translations: Record<string, unknown>,
  ids: readonly string[],
  minified: MinifiedIds
): MinifiedTranslations {
  const held: unknown[] = [];
  const places = new Map<string, number>();
  const lists: Record<string, number[]> = {};
  for (const id of sortIds([...ids])) {
    const hash = minified.hashes.get(id);
    if (
      hash === undefined ||
      !Object.prototype.hasOwnProperty.call(translations, hash) ||
      translations[hash] == null
    ) {
      continue;
    }
    const source = JSON.stringify(translations[hash]);
    let place = places.get(source);
    if (place === undefined) {
      place = held.push(translations[hash]) - 1;
      places.set(source, place);
    }
    const [name, number] = readId(id);
    const runs = (lists[name] ??= []);
    const last = runs.length - 3;
    if (
      last >= 0 &&
      runs[last] + runs[last + 2] === number &&
      runs[last + 1] + runs[last + 2] === place
    ) {
      runs[last + 2]++;
    } else {
      runs.push(number, place, 1);
    }
  }
  return [held, lists];
}

/** Whether a file of either shape, as it is written, holds no translation. */
export function isEmptyTranslations(source: string): boolean {
  return source === '{}' || source === '[[],{}]';
}

/**
 * Every id the final code of a build's chunks passes for each message, by
 * its hash: a file that holds a message of several chunks holds it under
 * the id of each.
 */
export function findPassedIds(
  chunks: readonly { code: string }[],
  ids: MinifiedIdReader
): Map<string, string[]> {
  const passed = new Map<string, Set<string>>();
  for (const { code } of chunks) {
    for (const id of findChunkIds(code, ids)) {
      const hash = ids.hashes.get(id)!;
      const held = passed.get(hash);
      if (held) held.add(id);
      else passed.set(hash, new Set([id]));
    }
  }
  return new Map([...passed].map(([hash, held]) => [hash, sortIds([...held])]));
}
