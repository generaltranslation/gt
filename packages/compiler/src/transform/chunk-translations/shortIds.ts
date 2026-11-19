import type { MessageTree } from '@generaltranslation/icu';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import type { TranslationsTable } from './loadTranslationFiles';

/**
 * A build with chunk translations writes both sides of a lookup: the id a
 * compiled call site passes, and the key of that message in the file the
 * call site reads. With short ids it writes a shorter id at both, and the
 * runtime looks one up under the other as it does a hash.
 *
 * A short id is the start of the message's hash in another alphabet, so it
 * is the same in every build and needs no table. The hash itself stays what
 * it is everywhere else: in the catalogs, in the unsplit file, at every call
 * site the runtime hashes, and inside this build, which reads short ids back
 * into hashes before it assigns messages to files.
 *
 * A short id is never as long as a hash, so it never equals the hash of
 * another message.
 */

/** Environment variable read when the `experimentalChunkTranslationsShortIds` option is not set. */
export const CHUNK_TRANSLATIONS_SHORT_IDS_ENV_VAR =
  'GT_CHUNK_TRANSLATIONS_SHORT_IDS';

/** The characters of a short id unless the build asks for another length: 48 bits of the hash. */
export const DEFAULT_SHORT_ID_LENGTH = 8;

export const MIN_SHORT_ID_LENGTH = 1;

/** A hash has 64 bits and a character of a short id holds 6. */
export const MAX_SHORT_ID_LENGTH = 10;

const COMPUTED_HASH = /^[0-9a-f]{16}$/;

/** Whether a string is a hash as the compiler and the CLI compute it. */
export function isComputedHash(hash: string): boolean {
  return COMPUTED_HASH.test(hash);
}

/**
 * The short id of a hash: its first `length * 6` bits in base64url, whose
 * characters need no escape in JSON or in any quotes of JavaScript.
 */
export function createShortId(hash: string, length: number): string {
  return Buffer.from(hash, 'hex').toString('base64url').slice(0, length);
}

/**
 * What a build with short ids knows of the call sites that hash their
 * message when they run, and so read it by hash.
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

/** The short ids of a build, once every module is compiled. */
export type ShortIds = {
  /** Matches the id a compiled call site passes, in a chunk's code */
  argument: RegExp;
  /** The hash of each short id a call site of the build can pass */
  hashes: ReadonlyMap<string, string>;
};

/** Two ids of messages that a page would read as one. */
export type ShortIdCollision = {
  id: string;
  /** The hashes, or the keys as the catalogs write them, that share it */
  keys: [string, string];
};

const createInvalidShortIdsError = (value: unknown) =>
  createDiagnosticMessage({
    source: '@generaltranslation/compiler',
    severity: 'Error',
    whatHappened: `The short ids of chunk translations are set to "${String(value)}", which is not true, false or a number of characters from ${MIN_SHORT_ID_LENGTH} to ${MAX_SHORT_ID_LENGTH}`,
    fix: `Set experimentalChunkTranslationsShortIds or ${CHUNK_TRANSLATIONS_SHORT_IDS_ENV_VAR} to true for ${DEFAULT_SHORT_ID_LENGTH} characters, or to a number of characters`,
  });

export const SHORT_IDS_WITHOUT_CHUNK_TRANSLATIONS_ERROR =
  createDiagnosticMessage({
    source: '@generaltranslation/compiler',
    severity: 'Error',
    whatHappened:
      'experimentalChunkTranslationsShortIds is set in a build without experimentalChunkTranslations',
    why: 'a short id is the key of a message in the translation files that only such a build writes',
    fix: `Turn experimentalChunkTranslations on, or leave experimentalChunkTranslationsShortIds and ${CHUNK_TRANSLATIONS_SHORT_IDS_ENV_VAR} out`,
  });

export const SHORT_IDS_WITH_TAGGED_IDS_ERROR = createDiagnosticMessage({
  source: '@generaltranslation/compiler',
  severity: 'Error',
  whatHappened:
    'experimentalChunkTranslationsShortIds cannot be used with _tagIds',
  why: 'a <T> then writes the id its call site passes into data-_gt-hash, where tools read the hash of the message',
  fix: `Remove _tagIds from gt.config.json, or leave experimentalChunkTranslationsShortIds and ${CHUNK_TRANSLATIONS_SHORT_IDS_ENV_VAR} out`,
});

// How many modules a warning names
const MAX_NAMED_MODULES = 5;

export const createRuntimeHashesWarning = (files: string[]) =>
  createDiagnosticMessage({
    source: '@generaltranslation/compiler',
    severity: 'Warning',
    whatHappened: `experimentalChunkTranslationsShortIds cannot tell which messages ${files.length === 1 ? 'a module reads' : `${files.length} modules read`} by a hash computed when the app runs`,
    why: 'a call site there builds its message from derive() or from parts that are not written at the call',
    reassurance:
      'Such a call site finds its translation in the unsplit file, unless a <T> or t template that the build compiled reads the same message, which then renders its source text there',
    fix: 'Write the message the same way at each call site, or turn the option off',
    details: [
      ...files.slice(0, MAX_NAMED_MODULES),
      ...(files.length > MAX_NAMED_MODULES
        ? [`and ${files.length - MAX_NAMED_MODULES} more`]
        : []),
    ],
  });

// How many pairs an error names
const MAX_NAMED_COLLISIONS = 5;

export const createShortIdCollisionError = (
  collisions: ShortIdCollision[],
  length: number
) =>
  createDiagnosticMessage({
    source: '@generaltranslation/compiler',
    severity: 'Error',
    whatHappened: `experimentalChunkTranslationsShortIds gives ${collisions.length === 1 ? 'two messages' : `${collisions.length} pairs of messages`} the same id of ${length} character${length === 1 ? '' : 's'}`,
    why: 'their hashes start with the same bits, and a page would render the translation of one for the other',
    fix:
      length < MAX_SHORT_ID_LENGTH
        ? `Set experimentalChunkTranslationsShortIds or ${CHUNK_TRANSLATIONS_SHORT_IDS_ENV_VAR} to more characters, up to ${MAX_SHORT_ID_LENGTH}`
        : 'Turn experimentalChunkTranslationsShortIds off',
    ...(length < MAX_SHORT_ID_LENGTH && { wayOut: 'turn the option off' }),
    details: [
      ...collisions
        .slice(0, MAX_NAMED_COLLISIONS)
        .map(({ id, keys }) => `${keys[0]} and ${keys[1]} share "${id}"`),
      ...(collisions.length > MAX_NAMED_COLLISIONS
        ? [`and ${collisions.length - MAX_NAMED_COLLISIONS} more`]
        : []),
    ],
  });

export const createReservedShortIdError = (
  reserved: { id: string; hash: string }[],
  length: number
) =>
  createDiagnosticMessage({
    source: '@generaltranslation/compiler',
    severity: 'Error',
    whatHappened: `experimentalChunkTranslationsShortIds gives a message an id that every JavaScript object already has a property for`,
    why: 'a page would read that property where the message has no translation',
    fix: `Set experimentalChunkTranslationsShortIds or ${CHUNK_TRANSLATIONS_SHORT_IDS_ENV_VAR} to another number of characters than ${length}`,
    wayOut: 'turn the option off',
    details: reserved.map(({ id, hash }) => `${hash} is "${id}"`),
  });

/**
 * How long this build's short ids are, or undefined when it writes hashes:
 * the `experimentalChunkTranslationsShortIds` option, else the
 * `GT_CHUNK_TRANSLATIONS_SHORT_IDS` environment variable. `true` is the
 * default length, a number that many characters.
 */
export function getShortIdLength(
  option: boolean | number | undefined
): number | undefined {
  const raw = option ?? process.env[CHUNK_TRANSLATIONS_SHORT_IDS_ENV_VAR];
  if (raw === undefined || raw === false) return undefined;
  if (raw === true) return DEFAULT_SHORT_ID_LENGTH;
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : raw;
  if (value === '' || value === 'false') return undefined;
  if (value === 'true') return DEFAULT_SHORT_ID_LENGTH;
  const length =
    typeof value === 'number' || /^\d+$/.test(value) ? Number(value) : NaN;
  if (
    !Number.isInteger(length) ||
    length < MIN_SHORT_ID_LENGTH ||
    length > MAX_SHORT_ID_LENGTH
  ) {
    throw new Error(createInvalidShortIdsError(raw));
  }
  return length;
}

/**
 * Every key of the build's translations that two messages must not share:
 * the hashes its call sites pass, and the keys of the catalogs it read.
 */
function getKeys(
  build: { hashes: ReadonlySet<string>; unsplit: ReadonlySet<string> },
  table: TranslationsTable
): string[] {
  const keys = new Set([...build.hashes, ...build.unsplit]);
  for (const translations of Object.values(table)) {
    for (const key of Object.keys(translations)) keys.add(key);
  }
  return [...keys].sort();
}

/**
 * The pairs of keys that would share an id, and the short ids that name a
 * property of every object. A hash is read by its short id; a key that is
 * no hash, which no call site of the build shortens, by itself.
 */
export function findShortIdCollisions(
  keys: readonly string[],
  length: number
): {
  collisions: ShortIdCollision[];
  reserved: { id: string; hash: string }[];
} {
  const taken = new Map<string, string>();
  const collisions: ShortIdCollision[] = [];
  const reserved: { id: string; hash: string }[] = [];
  for (const key of keys) {
    const isHash = isComputedHash(key);
    const id = isHash ? createShortId(key, length) : key;
    if (isHash && id in Object.prototype) reserved.push({ id, hash: key });
    const holder = taken.get(id);
    if (holder === undefined) taken.set(id, key);
    else if (holder !== key) collisions.push({ id, keys: [holder, key] });
  }
  return { collisions, reserved };
}

/**
 * The short ids of a build whose every module is compiled, for the code
 * that reads its chunks and writes its files. Throws when two messages of
 * the build or of its catalogs would share an id, so that no page ever
 * renders one message's translation for another: a build of other code, or
 * of the same code written another way, then has no collision either.
 */
export function createShortIds(
  length: number,
  build: { hashes: ReadonlySet<string>; unsplit: ReadonlySet<string> },
  table: TranslationsTable
): ShortIds {
  const { collisions, reserved } = findShortIdCollisions(
    getKeys(build, table),
    length
  );
  if (collisions.length) {
    throw new Error(createShortIdCollisionError(collisions, length));
  }
  if (reserved.length) {
    throw new Error(createReservedShortIdError(reserved, length));
  }
  const hashes = new Map<string, string>();
  for (const hash of build.hashes) {
    hashes.set(createShortId(hash, length), hash);
  }
  return {
    argument: new RegExp(
      `[{,]\\s*["']?\\$?_hash["']?\\s*:\\s*(["'\`])([A-Za-z0-9_-]{${length}})\\1`,
      'g'
    ),
    hashes,
  };
}
