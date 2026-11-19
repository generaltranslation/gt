import { defaultDefaultLocale } from '@generaltranslation/format/internal';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import type { ChunkImportMapOptions } from './chunkImportMap';
import type { GTConfig } from '../../config';
import { DEFAULT_REQUEST_COST } from './assignTranslationsByRegion';
import {
  SHORT_IDS_WITH_TAGGED_IDS_ERROR,
  type RuntimeReaders,
} from './shortIds';

/**
 * Environment variable read when the `experimentalChunkTranslations` option
 * is not set, so a build script can turn it on without changing the bundler
 * config.
 */
export const CHUNK_TRANSLATIONS_ENV_VAR = 'GT_CHUNK_TRANSLATIONS';

/** The entry compiled code loads translations with. */
export const CHUNK_TRANSLATIONS_SOURCE = 'gt-react/chunk-translations';

/** The object the startup script and gt-react's entry share; `getState()` there. */
export const CHUNK_TRANSLATIONS_GLOBAL = '__GT_CHUNK_TRANSLATIONS__';

/**
 * The file that says which file holds each chunk's translations, written
 * into the directory of the build's assets.
 */
export const CHUNK_TRANSLATIONS_MANIFEST = 'gt-chunk-translations.json';

/**
 * Written as the second argument of a wrapped dynamic import, and replaced
 * with the chunks that import loads once the bundler has named them.
 */
export const IMPORTED_CHUNKS_PLACEHOLDER = '__GT_CHUNK_TRANSLATIONS_IMPORT__';

/**
 * Written as the last argument of the call that starts the app, and taken
 * out again once every module is compiled: with the loader of the unsplit
 * file in its place when the build has one (see unsplitTranslations.ts).
 */
export const UNSPLIT_LOADER_PLACEHOLDER = '__GT_CHUNK_TRANSLATIONS_UNSPLIT__';

/** Every name the compiler declares in a module starts with this. */
export const CHUNK_TRANSLATIONS_LOCAL_PREFIX = '__gt_chunk_';

/** What compiled code imports from the entry, and the local name of each. */
export const CHUNK_TRANSLATIONS_IMPORTS = {
  load: { name: 'loadChunk', local: `${CHUNK_TRANSLATIONS_LOCAL_PREFIX}load` },
  initialize: {
    name: 'initializeChunkTranslations',
    local: `${CHUNK_TRANSLATIONS_LOCAL_PREFIX}initialize`,
  },
} as const;

export type ChunkTranslationsImport = keyof typeof CHUNK_TRANSLATIONS_IMPORTS;

// Bundlers whose output this build reads after chunking
const SUPPORTED_FRAMEWORKS = new Set(['vite']);

// A locale is part of a file name and of a URL
const FILE_NAME_LOCALE = /^[A-Za-z0-9_-]+$/;

const ENV_TRUE_VALUES = new Set(['true', '1']);
const ENV_FALSE_VALUES = new Set(['false', '0', '']);

/** What a build that writes translations per chunk shares between its hooks. */
export type ChunkTranslations = {
  defaultLocale: string;
  /** The locales that get files: every configured locale but the default one */
  locales: string[];
  /** Every hash a call site reads from the files, across the build's modules */
  hashes: Set<string>;
  /**
   * How many imports of `initializeGTSPA` the build has made start the app
   * with the files it writes, across its modules
   */
  starts: number;
  /**
   * The hashes of call sites the build saw and could not make read from the
   * files, such as `msg` templates. Their translations stay in the unsplit
   * file, also when another call site reads the same hash from a chunk's.
   */
  unsplit: Set<string>;
  /**
   * Where the bundler writes its chunk import map, when it writes one: set
   * from the bundler's options, once the build has them.
   */
  importMap?: ChunkImportMapOptions;
  naming: ChunkTranslationsNaming;
  /**
   * Set when the build splits the translations by the modules each load can
   * reach, not by chunk (see assignTranslationsByRegion).
   */
  regions?: RegionSplit;
  /**
   * Set when the call sites the build splits pass a short id of this many
   * characters, and the files of chunks are keyed by it (see shortIds.ts).
   */
  shortIdLength?: number;
  /**
   * In a build with short ids: what the call sites that hash their message
   * when they run can read, which stays under its hash.
   */
  runtimeReaders?: RuntimeReaders;
};

/** What a build that splits by module is given. */
export type RegionSplit = {
  /** λ: what one more request costs a load, in bytes */
  requestCost: number;
  /**
   * The path of the `gt-chunk-translations.json` an earlier build wrote,
   * whose files this build keeps where it can
   */
  previous: string | undefined;
};

/**
 * Environment variable read when the `experimentalChunkTranslationsSplit`
 * option is not set.
 */
export const CHUNK_TRANSLATIONS_SPLIT_ENV_VAR = 'GT_CHUNK_TRANSLATIONS_SPLIT';

/**
 * What decides which messages share a file: the chunk their call sites are
 * in (see assignTranslationsByChunk), or the modules each entry and dynamic
 * import can reach (see assignTranslationsByRegion).
 */
export const chunkTranslationsSplits = ['chunk', 'module'] as const;

export type ChunkTranslationsSplit = (typeof chunkTranslationsSplits)[number];

/** The split a build uses unless it asks for another. */
export const defaultChunkTranslationsSplit: ChunkTranslationsSplit = 'chunk';

/**
 * The split of this build: the `experimentalChunkTranslationsSplit` option,
 * else the `GT_CHUNK_TRANSLATIONS_SPLIT` environment variable.
 */
export function getChunkTranslationsSplit(
  option: ChunkTranslationsSplit | undefined
): ChunkTranslationsSplit {
  const raw = option ?? process.env[CHUNK_TRANSLATIONS_SPLIT_ENV_VAR];
  if (raw === undefined || raw === '') return defaultChunkTranslationsSplit;
  const split = chunkTranslationsSplits.find((known) => known === raw);
  if (split) return split;
  throw new Error(
    createDiagnosticMessage({
      source: '@generaltranslation/compiler',
      severity: 'Error',
      whatHappened: `The split of chunk translations is set to "${raw}", which is not one of ${chunkTranslationsSplits.join(', ')}`,
      fix: `Set experimentalChunkTranslationsSplit or ${CHUNK_TRANSLATIONS_SPLIT_ENV_VAR} to one of them`,
    })
  );
}

/**
 * Environment variable read when the
 * `experimentalChunkTranslationsRequestCost` option is not set.
 */
export const CHUNK_TRANSLATIONS_REQUEST_COST_ENV_VAR =
  'GT_CHUNK_TRANSLATIONS_REQUEST_COST';

/**
 * Environment variable read when the `experimentalChunkTranslationsPrevious`
 * option is not set.
 */
export const CHUNK_TRANSLATIONS_PREVIOUS_ENV_VAR =
  'GT_CHUNK_TRANSLATIONS_PREVIOUS';

/**
 * What a build that splits by module is given: the
 * `experimentalChunkTranslationsRequestCost` and
 * `experimentalChunkTranslationsPrevious` options, else the
 * `GT_CHUNK_TRANSLATIONS_REQUEST_COST` and `GT_CHUNK_TRANSLATIONS_PREVIOUS`
 * environment variables. Undefined for a build that splits by chunk.
 */
export function getRegionSplit(
  split: ChunkTranslationsSplit,
  options: { requestCost: number | undefined; previous: string | undefined }
): RegionSplit | undefined {
  if (split !== 'module') return undefined;
  const raw =
    options.requestCost ?? process.env[CHUNK_TRANSLATIONS_REQUEST_COST_ENV_VAR];
  const requestCost =
    raw === undefined || raw === '' ? DEFAULT_REQUEST_COST : Number(raw);
  if (!Number.isFinite(requestCost) || requestCost < 0) {
    throw new Error(
      createDiagnosticMessage({
        source: '@generaltranslation/compiler',
        severity: 'Error',
        whatHappened: `The request cost of chunk translations is set to "${raw}", which is not a number of bytes`,
        fix: `Set experimentalChunkTranslationsRequestCost or ${CHUNK_TRANSLATIONS_REQUEST_COST_ENV_VAR} to zero or more bytes, or leave it out for ${DEFAULT_REQUEST_COST}`,
      })
    );
  }
  const previous =
    options.previous ?? process.env[CHUNK_TRANSLATIONS_PREVIOUS_ENV_VAR];
  return { requestCost, previous: previous === '' ? undefined : previous };
}

/**
 * Environment variable read when the `experimentalChunkTranslationsNaming`
 * option is not set.
 */
export const CHUNK_TRANSLATIONS_NAMING_ENV_VAR = 'GT_CHUNK_TRANSLATIONS_NAMING';

/**
 * How the files of chunks are named, which decides what a page can request
 * when, and what a returning visitor downloads again (see
 * renderChunkTranslations): by one token per locale, or each by the hash of
 * its own content with a map of those hashes per locale.
 */
export const chunkTranslationsNamings = ['token', 'map'] as const;

export type ChunkTranslationsNaming = (typeof chunkTranslationsNamings)[number];

/** The naming a build uses unless it asks for another. */
export const defaultChunkTranslationsNaming: ChunkTranslationsNaming = 'token';

/**
 * The naming of this build: the `experimentalChunkTranslationsNaming`
 * option, else the `GT_CHUNK_TRANSLATIONS_NAMING` environment variable.
 *
 * A build that splits by module has `map` naming and no other. Its files
 * hold the messages of modules from many chunks, so the URL of a file cannot
 * follow from a chunk's, which is all `token` naming is for: the page needs a
 * table from each chunk to its files before it can request any, and that
 * table is the map.
 */
export function getChunkTranslationsNaming(
  option: ChunkTranslationsNaming | undefined,
  split: ChunkTranslationsSplit = defaultChunkTranslationsSplit
): ChunkTranslationsNaming {
  const raw = option ?? process.env[CHUNK_TRANSLATIONS_NAMING_ENV_VAR];
  if (raw === undefined || raw === '') {
    return split === 'module' ? 'map' : defaultChunkTranslationsNaming;
  }
  const naming = chunkTranslationsNamings.find((known) => known === raw);
  if (naming === 'token' && split === 'module') {
    throw new Error(
      createDiagnosticMessage({
        source: '@generaltranslation/compiler',
        severity: 'Error',
        whatHappened:
          'Chunk translations that are split by module cannot be named by token',
        why: 'a file then holds the messages of modules from many chunks, so its URL does not follow from the URL of a chunk',
        fix: `Set experimentalChunkTranslationsNaming or ${CHUNK_TRANSLATIONS_NAMING_ENV_VAR} to map, or leave it out`,
      })
    );
  }
  if (naming) return naming;
  throw new Error(
    createDiagnosticMessage({
      source: '@generaltranslation/compiler',
      severity: 'Error',
      whatHappened: `The naming of chunk translations is set to "${raw}", which is not one of ${chunkTranslationsNamings.join(', ')}`,
      fix: `Set experimentalChunkTranslationsNaming or ${CHUNK_TRANSLATIONS_NAMING_ENV_VAR} to one of them`,
    })
  );
}

/**
 * The name the entry exports what compiled code imports by: a build with
 * maps loads the files of an import with another function, and so does a
 * build that splits by module.
 */
export function getEntryExport(
  kind: ChunkTranslationsImport,
  naming: ChunkTranslationsNaming,
  splitsByModule = false
): string {
  return (
    (splitsByModule
      ? REGION_EXPORTS[kind]
      : naming === 'map'
        ? MAPPED_EXPORTS[kind]
        : undefined) ?? CHUNK_TRANSLATIONS_IMPORTS[kind].name
  );
}

const REGION_EXPORTS: Partial<Record<ChunkTranslationsImport, string>> = {
  load: 'loadRegionChunk',
  initialize: 'initializeRegionChunkTranslations',
};

const MAPPED_EXPORTS: Partial<Record<ChunkTranslationsImport, string>> = {
  load: 'loadMappedChunk',
  initialize: 'initializeMappedChunkTranslations',
};

const createInvalidChunkTranslationsEnvError = (value: string) =>
  createDiagnosticMessage({
    source: '@generaltranslation/compiler',
    severity: 'Error',
    whatHappened: `${CHUNK_TRANSLATIONS_ENV_VAR} is set to "${value}", which is not a boolean`,
    fix: `Set ${CHUNK_TRANSLATIONS_ENV_VAR} to true or false`,
  });

const createChunkTranslationsError = (why: string, fix: string) =>
  createDiagnosticMessage({
    source: '@generaltranslation/compiler',
    severity: 'Error',
    whatHappened:
      'experimentalChunkTranslations cannot write translations per chunk',
    why,
    fix,
  });

/**
 * Whether this build writes translations per chunk: the
 * `experimentalChunkTranslations` option, else the `GT_CHUNK_TRANSLATIONS`
 * environment variable.
 */
export function getChunkTranslations(option: boolean | undefined): boolean {
  if (option !== undefined) return option;
  const raw = process.env[CHUNK_TRANSLATIONS_ENV_VAR];
  if (raw === undefined) return false;
  const value = raw.trim().toLowerCase();
  if (ENV_TRUE_VALUES.has(value)) return true;
  if (ENV_FALSE_VALUES.has(value)) return false;
  throw new Error(createInvalidChunkTranslationsEnvError(raw));
}

/**
 * What the build writes files for, or the error that says why it cannot.
 */
export function resolveChunkTranslations(
  gtConfig: GTConfig | undefined,
  {
    framework,
    compileTimeHash,
    naming = defaultChunkTranslationsNaming,
    regions,
    shortIdLength,
  }: {
    framework: string;
    compileTimeHash: boolean;
    naming?: ChunkTranslationsNaming;
    regions?: RegionSplit;
    shortIdLength?: number;
  }
): ChunkTranslations | { error: string } {
  if (!SUPPORTED_FRAMEWORKS.has(framework)) {
    return {
      error: createChunkTranslationsError(
        `it reads the chunks a bundler wrote, which it does not do with ${framework}`,
        'Build with Vite, or turn the option off'
      ),
    };
  }
  if (!compileTimeHash) {
    return {
      error: createChunkTranslationsError(
        'compileTimeHash is false, and a file holds the translations of the hashes computed at build time',
        'Remove compileTimeHash: false'
      ),
    };
  }
  const gtFiles = gtConfig?.files?.gt;
  if (!gtFiles?.output?.includes('[locale]')) {
    return {
      error: createChunkTranslationsError(
        'files.gt.output does not say where the translations of each locale are',
        'Set files.gt.output in gt.config.json to the path of your translation files, with [locale] in it'
      ),
    };
  }
  const defaultLocale = gtConfig?.defaultLocale ?? defaultDefaultLocale;
  const locales = [...new Set(gtConfig?.locales)].filter(
    (locale) => locale !== defaultLocale
  );
  const unnamed = locales.find((locale) => !FILE_NAME_LOCALE.test(locale));
  if (unnamed !== undefined) {
    return {
      error: createChunkTranslationsError(
        `the locale "${unnamed}" cannot be part of a file name`,
        'Use locales made of letters, digits, hyphens and underscores'
      ),
    };
  }
  if (!locales.length) {
    return {
      error: createChunkTranslationsError(
        'gt.config.json lists no locale other than the default one',
        'Add the locales to translate into under locales'
      ),
    };
  }
  if (shortIdLength !== undefined && gtConfig?._tagIds === true) {
    return { error: SHORT_IDS_WITH_TAGGED_IDS_ERROR };
  }
  return {
    defaultLocale,
    locales,
    hashes: new Set(),
    starts: 0,
    unsplit: new Set(),
    naming,
    ...(regions && { regions }),
    ...(shortIdLength !== undefined && {
      shortIdLength,
      runtimeReaders: {
        compiled: new Map(),
        shapes: new Set(),
        unknown: new Set(),
      },
    }),
  };
}
