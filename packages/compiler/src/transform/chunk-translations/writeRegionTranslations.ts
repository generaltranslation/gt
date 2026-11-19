import fs from 'node:fs';
import path from 'node:path';
import type { GTOutputFileConfig } from 'generaltranslation';
import {
  createDiagnosticMessage,
  formatDiagnosticErrorDetails,
} from 'generaltranslation/diagnostics';
import { readChunkImportMap, type ChunkImportMap } from './chunkImportMap';
import type { TranslationsTable } from './loadTranslationFiles';
import {
  addChunkNames,
  findImportedNames,
  getChunkKey,
  renderImportedFiles,
  type ImportedFiles,
} from './assignTranslations';
import {
  assignTranslationsByRegion,
  findUncoveredMessages,
  fitCompressedSize,
  type RegionAssignment,
  type UncoveredMessage,
} from './assignTranslationsByRegion';
import {
  createRegionGraph,
  getMessageSizes,
  sampleCompressedSizes,
  type RegionChunk,
  type RegionModuleInfo,
} from './createRegionGraph';
import {
  CHUNK_TRANSLATIONS_MANIFEST,
  CHUNK_TRANSLATIONS_PREVIOUS_ENV_VAR,
  type ChunkTranslations,
  type RegionSplit,
} from './resolveChunkTranslations';
import { createShortIds } from './shortIds';
import { renderStartupScript } from './startupScript';
import {
  getUnsplitTranslations,
  UNSPLIT_TRANSLATIONS_KEY,
} from './unsplitTranslations';
import {
  createIsLoadedWith,
  CURRENT_NAMES_KEY,
  findBundledCatalogs,
  getFileHash,
  getFileName,
  loadChunkTranslationsTable,
  pickTranslations,
  renderCurrentNames,
  renderUnsplitFiles,
  TRANSLATIONS_MAP_KEY,
  type BundleFile,
} from './writeChunkTranslations';

/** What the map of a locale holds, in a build that splits by module. */
export type RegionMap = {
  /**
   * The files each dynamic import needs, by the imported chunk, as
   * gt-react's `listImportedFiles()` reads them. Left out when no import
   * needs a file.
   */
  i?: ImportedFiles & {
    /**
     * The hash in the name of the file whose key is at the same place in
     * `k`, 0 when the locale has no translation of its messages. The keys of
     * the files come first in `k`.
     */
    h: (string | 0)[];
  };
};

/** The file of a build that splits by module, and how it was fitted. */
export type RegionAssignmentRecord = {
  /** The hashes in each file, by the file's id */
  files: Record<string, string[]>;
  /**
   * What sample files of the translations compressed to, as pairs of raw and
   * compressed bytes: the next build estimates sizes from the same pairs, so
   * that a changed translation does not move the estimate under every file.
   */
  samples: [number, number][];
};

/**
 * The manifest of a build that splits by module: what a server that writes
 * its own HTML or preload links reads, and what the next build is given as
 * `experimentalChunkTranslationsPrevious` to keep its files where it can.
 */
export type RegionTranslationsManifest = {
  split: 'module';
  defaultLocale: string;
  /** The locales the build wrote files for */
  locales: string[];
  /** By the file of each entry chunk */
  entries: Record<
    string,
    {
      /** The keys of the files the entry holds before any code runs */
      files: string[];
      /** What the page runs before its modules, which `index.html` holds already */
      startupScript: string;
    }
  >;
  /** Every translations file, by its key and locale */
  files: Record<string, Record<string, string>>;
  /**
   * The keys to pass gt-react's `loadRegionChunkTranslations()` before a page
   * loads a dynamically imported chunk, by chunk file
   */
  imports: Record<string, string[]>;
  /** The map of each locale: which files each import needs, and their names */
  maps: Record<string, string>;
  /**
   * The one file whose name is the same in every build: the hash in the name
   * of each locale's map. A page that stayed open while the app was deployed
   * again reads it when a file it asks for is gone. Serve it as `index.html`
   * is served, not cached for good.
   */
  current?: string;
  /**
   * The file of the translations no other file holds, by locale, which a
   * page requests with its entry's files. Left out when the build has none.
   */
  unsplit?: Record<string, string>;
  assignment: RegionAssignmentRecord;
};

/** In the name of each file, before its id, inside the directory of the build's assets. */
const REGION_FILE_PREFIX = 'gt-';

// An id as assignTranslationsByRegion names a file: the start of a hash,
// with a counter when a whole hash was taken
const REGION_FILE_ID = /^[0-9a-f]+(?:-\d+)?$/;

// How many uncovered messages an error names
const MAX_NAMED_MESSAGES = 5;

export const createUncoveredMessagesError = (uncovered: UncoveredMessage[]) =>
  createDiagnosticMessage({
    source: '@generaltranslation/compiler',
    severity: 'Error',
    whatHappened: `Chunk translations split by module would leave ${uncovered.length} messages without their translation when the code that reads them runs`,
    why: 'the files listed for a dynamic import do not hold every message its modules read, which is a bug in the split and not in the app',
    fix: 'Set experimentalChunkTranslationsSplit to chunk, and report this with the details below',
    details: uncovered
      .slice(0, MAX_NAMED_MESSAGES)
      .map(
        ({ load, importer, hash }) =>
          `${hash} for ${path.relative(process.cwd(), load)}${importer ? `, imported in ${path.relative(process.cwd(), importer)}` : ''}`
      ),
  });

export const createConservativeSplitMessage = (messages: number) =>
  createDiagnosticMessage({
    source: '@generaltranslation/compiler',
    severity: 'Warning',
    whatHappened: `Chunk translations are split as if every module of a chunk reads its messages when the chunk loads, so pages load ${messages} messages of modules they never import`,
    why: 'this build runs every module of a chunk when the chunk loads, and a module can read a translation as it runs',
    reassurance: 'Every page still gets the translations it renders',
    fix: 'With Vite 8 or Rolldown, set output.strictExecutionOrder to true (build.rolldownOptions.output in Vite), so a module runs when it is first imported and a page loads only the translations of the modules it reaches',
  });

export const createMissingPreviousWarning = (file: string) =>
  createDiagnosticMessage({
    source: '@generaltranslation/compiler',
    severity: 'Warning',
    whatHappened: `Found no previous chunk translations at ${file}`,
    reassurance:
      'The build assigns its translation files from nothing, as a first build does',
    fix: `Point experimentalChunkTranslationsPrevious or ${CHUNK_TRANSLATIONS_PREVIOUS_ENV_VAR} at the gt-chunk-translations.json of the build before this one`,
  });

const createInvalidPreviousError = (file: string, details?: string) =>
  createDiagnosticMessage({
    source: '@generaltranslation/compiler',
    severity: 'Error',
    whatHappened: `Could not read the previous chunk translations at ${file}`,
    why: 'it is not the gt-chunk-translations.json of a build that splits by module',
    fix: `Point experimentalChunkTranslationsPrevious or ${CHUNK_TRANSLATIONS_PREVIOUS_ENV_VAR} at that file of the build before this one, or leave it out`,
    ...(details !== undefined && { details }),
  });

const createFileKeyClashError = (key: string) =>
  createDiagnosticMessage({
    source: '@generaltranslation/compiler',
    severity: 'Error',
    whatHappened: `A translations file and a chunk would share the key ${key}`,
    why: 'a build that splits chunk translations by module names its files gt-<id> next to the chunks',
    fix: 'Give the chunk another name',
  });

/**
 * The file each message was in after an earlier build, and the size samples
 * that build fitted its estimate to, from the manifest it wrote. Undefined
 * when there is no file at the path.
 */
export function readPreviousAssignment(
  file: string
): { files: Map<string, string>; samples: [number, number][] } | undefined {
  if (!fs.existsSync(file)) return undefined;
  let record: unknown;
  try {
    record = (
      JSON.parse(fs.readFileSync(file, 'utf8')) as { assignment?: unknown }
    )?.assignment;
  } catch (error) {
    throw new Error(
      createInvalidPreviousError(file, formatDiagnosticErrorDetails(error))
    );
  }
  const { files, samples } = (record ?? {}) as Partial<RegionAssignmentRecord>;
  const isValid =
    files !== null &&
    typeof files === 'object' &&
    Object.entries(files).every(
      ([id, hashes]) =>
        REGION_FILE_ID.test(id) &&
        Array.isArray(hashes) &&
        hashes.every((hash) => typeof hash === 'string')
    ) &&
    Array.isArray(samples) &&
    samples.every(
      (sample) =>
        Array.isArray(sample) &&
        sample.length === 2 &&
        sample.every((bytes) => typeof bytes === 'number')
    );
  if (!isValid) throw new Error(createInvalidPreviousError(file));
  const previous = new Map<string, string>();
  for (const [id, hashes] of Object.entries(files!)) {
    for (const hash of hashes) previous.set(hash, id);
  }
  return { files: previous, samples: samples! };
}

/**
 * The files of a build that splits by module, from which messages go into
 * which file and the translations of its locales: each file per locale, each
 * locale's map, and the manifest.
 *
 * - A file is named by its key (`gt-` and the id the assignment gave it), the
 *   locale and the hash of its own content, and written only when the locale
 *   translates one of its messages. No message is in two files.
 * - The map of a locale holds which files each dynamic import needs, by the
 *   imported chunk, and the hash in the name of each of those files. It is
 *   the one file a page finds every other by, so the page's startup script
 *   holds the hash in its name and requests it while the HTML is parsed.
 *   gt-react reads it as it reads the entry's file of a build that splits by
 *   chunk, which holds the same lists.
 * - The script also holds the hashes of the files the entry holds, and
 *   requests those with the map: they wait for nothing.
 *
 * The lists are in the map and not in a file of translations because no file
 * is the entry's alone here: an import needs the map anyway to name its
 * files, a page in the default locale requests neither, and a lost file of
 * translations then costs only its own messages.
 *
 * No chunk's code changes when a translation does: the file it is in and the
 * locale's map get a new name, and the HTML the map's hash.
 *
 * @param entries The ids of the files each entry holds, by the entry chunk's file.
 * @param imports The ids of the files a dynamic import needs, by the imported chunk's file.
 */
export function renderRegionTranslations(
  assignment: {
    files: ReadonlyMap<string, readonly string[]>;
    entries: ReadonlyMap<string, readonly string[]>;
    imports: ReadonlyMap<string, readonly string[]>;
    /** In a build with a chunk import map, the names its imports are written with */
    importedNames?: ChunkImportMap;
  },
  build: Pick<ChunkTranslations, 'defaultLocale' | 'locales' | 'shortIdLength'>,
  table: TranslationsTable,
  {
    base,
    assetsDir,
    samples,
    unsplit,
  }: {
    /** The URL the build's files are served from */
    base: string;
    /** Where the files go, inside the output directory */
    assetsDir: string;
    samples: [number, number][];
    /** The translations of each locale that has an unsplit file, see getUnsplitTranslations */
    unsplit: Record<string, Record<string, unknown>>;
  }
): {
  files: { fileName: string; source: string }[];
  manifest: RegionTranslationsManifest;
  /** The unsplit file of each locale that has one */
  unsplit: { locale: string; count: number; bytes: number }[];
  /** Writes the startup script of each entry chunk, by its file, for a page that finds the build's files at a base */
  startupScripts: Map<string, (base: string) => string>;
} {
  const getKey = (id: string) =>
    path.posix.join(assetsDir, `${REGION_FILE_PREFIX}${id}`);
  const getKeys = (ids: readonly string[]) => ids.map(getKey);
  const locales = build.locales.filter((locale) => table[locale]);
  const files: { fileName: string; source: string }[] = [];
  const manifest: Omit<RegionTranslationsManifest, 'assignment'> = {
    split: 'module',
    defaultLocale: build.defaultLocale,
    locales,
    entries: {},
    files: {},
    imports: Object.fromEntries(
      [...assignment.imports].map(([chunk, ids]) => [chunk, getKeys(ids)])
    ),
    maps: {},
  };
  const { unsplitHashes, unsplitFiles } = renderUnsplitFiles(
    {
      key: path.posix.join(assetsDir, UNSPLIT_TRANSLATIONS_KEY),
      translations: unsplit,
    },
    files,
    manifest
  );
  const fileKeys = new Set([...assignment.files.keys()].map(getKey));
  // The lists know a chunk by its file and by the names its imports are written with
  const listed = addChunkNames(
    new Map(Object.entries(manifest.imports)),
    assignment.importedNames
  );
  for (const chunk of listed.keys()) {
    if (fileKeys.has(getChunkKey(chunk))) {
      throw new Error(createFileKeyClashError(getChunkKey(chunk)));
    }
  }
  const lists = renderImportedFiles(listed);
  const mapKey = path.posix.join(assetsDir, TRANSLATIONS_MAP_KEY);
  const mapHashes: Record<string, string> = {};
  const fileHashes: Record<string, Record<string, string>> = {};
  for (const locale of locales) {
    const hashes: Record<string, string> = (fileHashes[locale] = {});
    for (const [id, messages] of assignment.files) {
      const source = JSON.stringify(
        pickTranslations(table[locale], [...messages], build.shortIdLength)
      );
      if (source === '{}') continue;
      const key = getKey(id);
      hashes[key] = getFileHash(source);
      const fileName = getFileName(key, locale, hashes[key]);
      files.push({ fileName, source });
      (manifest.files[key] ??= {})[locale] = fileName;
    }
    const map: RegionMap = {};
    if (lists) {
      const named: (string | 0)[] = [];
      for (const key of lists.k) {
        if (!fileKeys.has(key)) break;
        named.push(hashes[key] ?? 0);
      }
      map.i = { ...lists, h: named };
    }
    const source = JSON.stringify(map);
    mapHashes[locale] = getFileHash(source);
    const fileName = getFileName(mapKey, locale, mapHashes[locale]);
    files.push({ fileName, source });
    manifest.maps[locale] = fileName;
  }

  // A build without files for any locale has no names to give
  const current = locales.length
    ? path.posix.join(assetsDir, CURRENT_NAMES_KEY)
    : undefined;
  if (current !== undefined) {
    const names = renderCurrentNames(current, mapHashes);
    files.push(names);
    manifest.current = names.fileName;
  }

  const startupScripts = new Map<string, (base: string) => string>();
  for (const [entry, ids] of assignment.entries) {
    const keys = getKeys(ids);
    const renderScript = (pageBase: string) =>
      renderStartupScript({
        base: pageBase,
        entry: mapKey,
        hashes: mapHashes,
        tokens: {},
        regions: Object.fromEntries(
          locales.map((locale) => [
            locale,
            Object.fromEntries(
              keys.flatMap((key) =>
                fileHashes[locale][key] ? [[key, fileHashes[locale][key]]] : []
              )
            ),
          ])
        ),
        locales: [build.defaultLocale, ...build.locales],
        ...(unsplitFiles.length && {
          unsplit: {
            key: path.posix.join(assetsDir, UNSPLIT_TRANSLATIONS_KEY),
            hashes: unsplitHashes,
          },
        }),
        current,
      });
    startupScripts.set(entry, renderScript);
    manifest.entries[entry] = {
      files: keys,
      startupScript: renderScript(base),
    };
  }
  return {
    files,
    startupScripts,
    manifest: {
      ...manifest,
      assignment: {
        files: Object.fromEntries(
          [...assignment.files].map(([id, hashes]) => [id, [...hashes]])
        ),
        samples,
      },
    },
    unsplit: unsplitFiles,
  };
}

type RegionBundleFile = BundleFile & Partial<RegionChunk>;

/**
 * The ids of the files a dynamic import needs, by the file of the chunk it
 * imports, and the same by the module it names, for findUncoveredMessages.
 *
 * An import of a module loads the chunk that is made for the module or holds
 * it, so a chunk's list is the demand of every such module in it. A module
 * no chunk holds was dropped by the bundler with every import of it, and
 * loads nothing.
 */
function listImportedRegions(
  chunks: readonly RegionChunk[],
  demands: ReadonlyMap<string, readonly string[]>
): { byChunk: Map<string, string[]>; byModule: Map<string, string[]> } {
  const byChunk = new Map<string, string[]>();
  const chunksOfModule = new Map<string, string[]>();
  for (const chunk of chunks) {
    const ids = new Set<string>();
    const modules = new Set(Object.keys(chunk.modules));
    if (chunk.facadeModuleId) modules.add(chunk.facadeModuleId);
    for (const module of modules) {
      const demanded = demands.get(module);
      if (!demanded) continue;
      for (const id of demanded) ids.add(id);
      const holding = chunksOfModule.get(module);
      if (holding) holding.push(chunk.fileName);
      else chunksOfModule.set(module, [chunk.fileName]);
    }
    if (ids.size) byChunk.set(chunk.fileName, [...ids].sort());
  }
  const byModule = new Map<string, string[]>();
  for (const [module, demanded] of demands) {
    const holding = chunksOfModule.get(module);
    if (!holding) {
      byModule.set(module, [...demanded]);
      continue;
    }
    // What every chunk an import of the module can load lists
    const [first, ...rest] = holding.map((file) => byChunk.get(file) ?? []);
    byModule.set(
      module,
      first.filter((id) => rest.every((list) => list.includes(id)))
    );
  }
  return { byChunk, byModule };
}

/**
 * Called once the bundler has written its chunks, in a build that splits by
 * module: assigns the messages from the module graph, checks that every load
 * holds what it reads, and emits the translation files, the maps and the
 * manifest. Throws when a message would be left uncovered.
 *
 * Returns what writeChunkTranslations returns, with what the assignment says
 * about itself.
 */
export function writeRegionTranslations(
  bundle: Record<string, RegionBundleFile>,
  build: ChunkTranslations & { regions: RegionSplit },
  {
    gtFiles,
    base,
    assetsDir,
    emitFile,
    getModuleInfo,
    isLazy,
  }: {
    gtFiles: GTOutputFileConfig;
    /** The URL the build's files are served from */
    base: string;
    /** Where the files go, inside the output directory */
    assetsDir: string;
    emitFile: (file: {
      type: 'asset';
      fileName: string;
      source: string;
    }) => unknown;
    getModuleInfo: (id: string) => RegionModuleInfo | null;
    /** Whether a module runs only when it is first imported, see initialisesModulesLazily */
    isLazy: boolean;
  }
): {
  startupScripts: Map<string, (base: string) => string>;
  missingLocales: string[];
  unsplit: { locale: string; count: number; bytes: number }[];
  imported: Set<string>;
  /** Whether loading the first chunk loads the second, as one it imports statically */
  isLoadedWith: (chunk: string, other: string) => boolean;
  bundledCatalogs: string[];
  /** Whether `regions.previous` names a file that is not there */
  missingPrevious: boolean;
  stats: RegionAssignment['stats'] & { files: number };
  /**
   * The chunk import map as the bundle held it when the lists were written.
   * What the build later writes at an import is resolved through this map
   * and no later one, which another plugin may have rewritten.
   */
  importMap: ChunkImportMap | undefined;
  /** The names the lists hold the imported chunks under, see findImportedNames */
  importedNames: ChunkImportMap | undefined;
} {
  const chunks = Object.values(bundle).filter(
    (file): file is RegionBundleFile & RegionChunk =>
      file.type === 'chunk' &&
      typeof file.code === 'string' &&
      file.modules !== undefined
  );
  const importMap = readChunkImportMap(bundle, build.importMap);
  const importedNames = findImportedNames(chunks, importMap);
  const table = loadChunkTranslationsTable(gtFiles, build);
  const previous =
    build.regions.previous === undefined
      ? undefined
      : readPreviousAssignment(build.regions.previous);

  const { graph } = createRegionGraph(chunks, getModuleInfo, build.hashes, {
    isLazy,
    ...(build.shortIdLength !== undefined && {
      shortIds: createShortIds(build.shortIdLength, build, table),
    }),
  });
  const sizes = getMessageSizes(table, build.hashes);
  const sampled = build.locales.find((locale) => table[locale]);
  const samples =
    previous?.samples ??
    (sampled
      ? sampleCompressedSizes(table[sampled], sizes).map(
          ({ bytes, compressed }): [number, number] => [bytes, compressed]
        )
      : []);
  const assignment = assignTranslationsByRegion(graph, {
    sizes,
    requestCost: build.regions.requestCost,
    estimateSize: fitCompressedSize(
      samples.map(([bytes, compressed]) => ({ bytes, compressed }))
    ),
    previous: previous?.files,
  });

  const imports = listImportedRegions(chunks, assignment.demands);
  const uncovered = findUncoveredMessages(graph, {
    entries: assignment.entries,
    files: assignment.files,
    imports: imports.byModule,
    // One list for an imported chunk, wherever the import is written
    getImportedFiles: (_importer, target) => imports.byModule.get(target) ?? [],
  });
  if (uncovered.length)
    throw new Error(createUncoveredMessagesError(uncovered));

  const { files, manifest, unsplit, startupScripts } = renderRegionTranslations(
    {
      files: assignment.files,
      entries: new Map(
        chunks.flatMap((chunk) =>
          chunk.isEntry
            ? [
                [
                  chunk.fileName,
                  (chunk.facadeModuleId &&
                    assignment.entries.get(chunk.facadeModuleId)) ||
                    [],
                ] as const,
              ]
            : []
        )
      ),
      imports: imports.byChunk,
      importedNames,
    },
    build,
    table,
    { base, assetsDir, samples, unsplit: getUnsplitTranslations(table, build) }
  );
  for (const file of files) emitFile({ type: 'asset', ...file });
  emitFile({
    type: 'asset',
    fileName: path.posix.join(assetsDir, CHUNK_TRANSLATIONS_MANIFEST),
    source: JSON.stringify(manifest, null, 2),
  });
  return {
    startupScripts,
    missingLocales: build.locales.filter((locale) => !table[locale]),
    unsplit,
    imported: new Set(imports.byChunk.keys()),
    isLoadedWith: createIsLoadedWith(chunks),
    bundledCatalogs: findBundledCatalogs(chunks, gtFiles, build),
    missingPrevious: build.regions.previous !== undefined && !previous,
    stats: { ...assignment.stats, files: assignment.files.size },
    importMap,
    importedNames,
  };
}
