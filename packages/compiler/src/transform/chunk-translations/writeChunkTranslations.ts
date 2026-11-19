import { createHash } from 'node:crypto';
import path from 'node:path';
import type { GTOutputFileConfig } from 'generaltranslation';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import {
  loadTranslationFiles,
  resolveTranslationFiles,
  type TranslationsTable,
} from './loadTranslationFiles';
import {
  assignTranslationsByChunk,
  findChunkHashes,
  findImportedChunks,
  findUncoveredChunkMessages,
  getChunkKey,
  renderImportedFiles,
  renderMappedFiles,
  type AssignedChunk,
  type TranslationAssignment,
  type UncoveredChunkMessage,
  type UngatedImports,
} from './assignTranslations';
import { readChunkImportMap } from './chunkImportMap';
import {
  CHUNK_TRANSLATIONS_MANIFEST,
  type ChunkTranslations,
} from './resolveChunkTranslations';
import { renderStartupScript } from './startupScript';
import {
  getUnsplitTranslations,
  UNSPLIT_TRANSLATIONS_KEY,
} from './unsplitTranslations';

/** A file of the bundle, as Rollup, Rolldown and Vite pass it to a plugin. */
type BundleFile = {
  type: string;
  code?: string;
  /** The modules the bundler put into a chunk */
  moduleIds?: string[];
} & Partial<Omit<AssignedChunk, 'hashes'>>;

/**
 * What a server that writes its own HTML or preload links reads: which file
 * holds the translations of each chunk in each locale.
 */
export type ChunkTranslationsManifest = {
  defaultLocale: string;
  /** The locales the build wrote files for */
  locales: string[];
  /** By the file of each entry chunk */
  entries: Record<
    string,
    {
      /** The entry's translations file, by locale */
      translations: Record<string, string>;
      /** What the page runs before its modules, which `index.html` holds already */
      startupScript: string;
    }
  >;
  /**
   * Every other translations file, by its key and locale. In a build that
   * names each file by its own hash, keys whose files hold the same are given
   * one file.
   */
  files: Record<string, Record<string, string>>;
  /**
   * The keys to pass gt-react's `loadChunkTranslations()` before a page that
   * started from an entry loads a dynamically imported chunk, by chunk file
   */
  imports: Record<string, string[]>;
  /**
   * The file of the translations no chunk's file holds, by locale, which a
   * page requests with its entry's file. Left out when the build has none.
   */
  unsplit?: Record<string, string>;
  /**
   * The map of each locale, in a build that names each file by its own hash:
   * the hash in the name of every file under `files`, by its key, and the
   * files each dynamic import needs.
   */
  maps?: Record<string, string>;
};

/** The key of a locale's map, inside the directory of the build's assets. */
const TRANSLATIONS_MAP_KEY = 'gt-map';

/**
 * The key of every file a build names by its own hash alone, inside the
 * directory of the build's assets: the files of chunks and of entries.
 */
const CONTENT_FILES_KEY = 'gt';

/** Where a build that names each file by its own hash puts its files. */
export type TranslationMaps = {
  /** The key of the maps */
  key: string;
  /** The key of every file of a chunk or an entry */
  files: string;
};

const FILE_HASH_LENGTH = 8;

// A file named by its content alone shares its names with every such file of
// the locale: those of this build, and those of earlier builds that a
// visitor's cache still holds for good. A hash this long keeps two contents
// from ever sharing a name.
const CONTENT_HASH_LENGTH = 16;

export const createMissingTranslationsWarning = (locales: string[]) =>
  createDiagnosticMessage({
    source: '@generaltranslation/compiler',
    severity: 'Warning',
    whatHappened: `Wrote no chunk translations for ${locales.map((locale) => `"${locale}"`).join(', ')}`,
    why: 'files.gt.output has no translations file for them',
    reassurance: 'Those locales render the source text',
    fix: 'Add their translation files and build again',
  });

export const UNSTARTED_APP_WARNING = createDiagnosticMessage({
  source: '@generaltranslation/compiler',
  severity: 'Warning',
  whatHappened:
    'experimentalChunkTranslations did not find the initializeGTSPA that starts the app',
  why: "no module the build compiled imports it by name, as import { initializeGTSPA } from 'gt-react': a namespace import, a re-export or an import through another module is not read",
  reassurance:
    "initializeGTSPA then still calls the app's loadTranslations, so a page loads its locale's whole catalog as well as the files of its chunks",
  fix: "Import initializeGTSPA by name from 'gt-react' in the module that calls it",
});

export const createBundledCatalogsWarning = (files: string[]) =>
  createDiagnosticMessage({
    source: '@generaltranslation/compiler',
    severity: 'Warning',
    whatHappened: `The build still bundles ${files.join(', ')}`,
    why: 'the app imports them, and a build with chunk translations takes only a loadTranslations function out of the object initializeGTSPA is called with',
    reassurance:
      'Nothing loads them, but a changed translation renames the chunk that names them',
    fix: 'Pass loadTranslations to initializeGTSPA as a function or the name of one, in the object it is called with',
  });

// How many messages or imports a diagnostic names
const MAX_NAMED = 5;

const nameSome = (names: string[]) =>
  `${names.slice(0, MAX_NAMED).join(', ')}${names.length > MAX_NAMED ? `, and ${names.length - MAX_NAMED} more` : ''}`;

export const createUncoveredChunkMessagesError = (
  uncovered: UncoveredChunkMessage[]
) =>
  createDiagnosticMessage({
    source: '@generaltranslation/compiler',
    severity: 'Error',
    whatHappened: `experimentalChunkTranslations would leave ${uncovered.length} messages without their translations`,
    why: 'the files the build lists for a load do not hold every message of the chunks that load runs',
    fix: 'Turn the option off and report this to General Translation: the build assigned its files wrongly',
    details: nameSome(
      uncovered.map(
        ({ hash, chunk, load }) => `${hash} in ${chunk}, loaded by ${load}`
      )
    ),
  });

export const createUnreadImportsError = (imports: UngatedImports[]) =>
  createDiagnosticMessage({
    source: '@generaltranslation/compiler',
    severity: 'Error',
    whatHappened:
      'experimentalChunkTranslations could not tell which chunk a dynamic import loads',
    why: 'the bundler printed the import in a form the build does not read, so its chunk would run before its translations and render their source text',
    fix: 'Turn the option off and report this to General Translation with the import named below',
    details: nameSome(
      imports.map(
        ({ chunk, targets }) => `${chunk} imports ${targets.join(', ')}`
      )
    ),
  });

export const createUngatedImportsWarning = (imports: UngatedImports[]) =>
  createDiagnosticMessage({
    source: '@generaltranslation/compiler',
    severity: 'Warning',
    whatHappened: `Nothing waits for the translations of ${nameSome(imports.flatMap(({ targets }) => targets))}`,
    why: 'a dynamic import the build does not wrap loads them: one with a computed path, in a dependency, or in a CommonJS module',
    reassurance:
      'Their messages render the source text until the files arrive, if the page requests them at all',
    fix: 'Import those chunks with import() of a literal path from a module of the app',
    details: nameSome(
      imports.map(
        ({ chunk, targets }) => `${chunk} imports ${targets.join(', ')}`
      )
    ),
  });

function getFileHash(source: string): string {
  return getDigest(source).slice(0, FILE_HASH_LENGTH);
}

function getDigest(source: string): string {
  return createHash('sha256').update(source).digest('hex');
}

/** The hash in the name of a file that has only that hash to tell it from others. */
function getContentHash(source: string): string {
  return getDigest(source).slice(0, CONTENT_HASH_LENGTH);
}

/** The translations of `hashes` that `locale` has, in their order. */
function pickTranslations(
  translations: Record<string, unknown>,
  hashes: string[]
): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const hash of hashes) {
    if (
      Object.prototype.hasOwnProperty.call(translations, hash) &&
      translations[hash] != null
    ) {
      picked[hash] = translations[hash];
    }
  }
  return picked;
}

/**
 * The files of a build, from which messages go into which file and the
 * translations of its locales: each file per locale, and the manifest.
 *
 * - An entry's file is named by the entry chunk's key, the locale and the
 *   hash of its own content, which the page's startup script holds. It also
 *   holds which files each dynamic import needs (see renderImportedFiles).
 * - Every other file is named by its key, the locale and the locale's token:
 *   one hash of all of them. The startup script holds that token too, so a
 *   file's URL follows from its chunk's, and the page can request the files
 *   of the chunks it preloads before anything else has arrived. A file is
 *   written for every locale, also when it holds nothing.
 *
 * No chunk's code changes when a translation does. A locale's files, and the
 * HTML, do: a change to any of them gives all of them a new name, so each
 * name stays one content for good and can be cached as immutable.
 *
 * With `maps`, every file is named by the locale and the hash of its own
 * content alone, the entry's too, and a chunk's file is written only when it
 * holds something. No name holds a chunk's, so a build that changes only
 * JavaScript, which renames chunks, renames no file that holds translations,
 * and files that hold the same are one file. Their hashes are longer, as
 * nothing else tells them apart. One more file per locale, the
 * map, holds everything that names a chunk: the hash in the name of each
 * chunk's file and the files each dynamic import needs (see
 * renderMappedFiles). The startup script holds the hash in the map's name. A
 * changed translation renames only the files it is in and the locale's map,
 * and the files of chunks are requested once the map has arrived.
 */
export function renderChunkTranslations(
  assignment: TranslationAssignment,
  build: Pick<ChunkTranslations, 'defaultLocale' | 'locales'>,
  table: TranslationsTable,
  base: string,
  unsplit?: {
    /** The key of the unsplit files */
    key: string;
    /** The translations of each locale that has such a file, see getUnsplitTranslations */
    translations: Record<string, Record<string, unknown>>;
  },
  /** Set in a build that names each file by its own hash */
  maps?: TranslationMaps
): {
  files: { fileName: string; source: string }[];
  manifest: ChunkTranslationsManifest;
  /** The unsplit file of each locale that has one */
  unsplit: { locale: string; count: number; bytes: number }[];
  /** Writes the startup script of each entry chunk, by its file, for a page that finds the build's files at a base */
  startupScripts: Map<string, (base: string) => string>;
} {
  const locales = build.locales.filter((locale) => table[locale]);
  const files: { fileName: string; source: string }[] = [];
  const written = new Set<string>();
  /** Files named by their content have one name when they hold the same. */
  const write = (fileName: string, source: string): string => {
    if (!written.has(fileName)) files.push({ fileName, source });
    written.add(fileName);
    return fileName;
  };
  const getEntryKey = (entry: string) =>
    maps ? maps.files : getChunkKey(entry);
  const manifest: ChunkTranslationsManifest = {
    defaultLocale: build.defaultLocale,
    locales,
    entries: {},
    files: {},
    imports: Object.fromEntries(assignment.imports),
  };
  const entryHashes = new Map<string, Record<string, string>>();
  const unsplitHashes: Record<string, string> = {};
  const unsplitFiles: { locale: string; count: number; bytes: number }[] = [];
  for (const [locale, translations] of Object.entries(
    unsplit?.translations ?? {}
  )) {
    const source = JSON.stringify(translations);
    const hash = getFileHash(source);
    const fileName = getFileName(unsplit!.key, locale, hash);
    files.push({ fileName, source });
    unsplitHashes[locale] = hash;
    (manifest.unsplit ??= {})[locale] = fileName;
    unsplitFiles.push({
      locale,
      count: Object.keys(translations).length,
      bytes: Buffer.byteLength(source),
    });
  }

  const imported = renderImportedFiles(
    assignment.imports,
    assignment.importMap
  );
  const tokens: Record<string, string> = {};
  for (const locale of locales) {
    const sources = [...assignment.files].map(
      ([key, hashes]) =>
        [key, JSON.stringify(pickTranslations(table[locale], hashes))] as const
    );
    // The map holds the files each import needs; without one, the entry's file does
    const entrySources = [...assignment.entries].map(
      ([entry, hashes]) =>
        [
          entry,
          JSON.stringify({
            t: pickTranslations(table[locale], hashes),
            ...(imported && !maps && { i: imported }),
          }),
        ] as const
    );
    if (maps) {
      const hashes: Record<string, string> = {};
      for (const [key, source] of sources) {
        // A chunk's file is written when it holds something
        if (source === '{}') continue;
        hashes[key] = getContentHash(source);
        (manifest.files[key] ??= {})[locale] = write(
          getFileName(maps.files, locale, hashes[key]),
          source
        );
      }
      const map = JSON.stringify({ i: renderMappedFiles(imported, hashes) });
      tokens[locale] = getFileHash(map);
      (manifest.maps ??= {})[locale] = write(
        getFileName(maps.key, locale, tokens[locale]),
        map
      );
    } else {
      const token = getFileHash(JSON.stringify(sources));
      tokens[locale] = token;
      for (const [key, source] of sources) {
        const fileName = getFileName(key, locale, token);
        files.push({ fileName, source });
        (manifest.files[key] ??= {})[locale] = fileName;
      }
    }
    for (const [entry, source] of entrySources) {
      const hash = maps ? getContentHash(source) : getFileHash(source);
      write(getFileName(getEntryKey(entry), locale, hash), source);
      let byLocale = entryHashes.get(entry);
      if (!byLocale) entryHashes.set(entry, (byLocale = {}));
      byLocale[locale] = hash;
    }
  }

  const startupScripts = new Map<string, (base: string) => string>();
  for (const entry of assignment.entries.keys()) {
    const hashes = entryHashes.get(entry) ?? {};
    const renderScript = (pageBase: string) =>
      renderStartupScript({
        base: pageBase,
        entry: getEntryKey(entry),
        hashes,
        tokens,
        ...(maps ? { maps } : { files: [...assignment.files.keys()] }),
        locales: [build.defaultLocale, ...build.locales],
        ...(unsplit &&
          unsplitFiles.length && {
            unsplit: { key: unsplit.key, hashes: unsplitHashes },
          }),
      });
    startupScripts.set(entry, renderScript);
    manifest.entries[entry] = {
      translations: Object.fromEntries(
        Object.entries(hashes).map(([locale, hash]) => [
          locale,
          getFileName(getEntryKey(entry), locale, hash),
        ])
      ),
      startupScript: renderScript(base),
    };
  }
  return { files, manifest, unsplit: unsplitFiles, startupScripts };
}

function findBundledCatalogs(
  chunks: BundleFile[],
  gtFiles: GTOutputFileConfig,
  build: Pick<ChunkTranslations, 'locales'>
): string[] {
  const catalogs = new Map(
    resolveTranslationFiles(gtFiles.output ?? '', build.locales).map(
      ({ filePath }) => [path.resolve(filePath), filePath]
    )
  );
  const bundled = new Set<string>();
  for (const chunk of chunks) {
    for (const id of chunk.moduleIds ?? []) {
      const catalog = catalogs.get(path.resolve(id.split('?')[0]));
      if (catalog) bundled.add(catalog);
    }
  }
  return [...bundled].map((file) => path.relative(process.cwd(), file)).sort();
}

/** The translations file of each of the build's locales that has one. */
export function loadChunkTranslationsTable(
  gtFiles: GTOutputFileConfig,
  build: Pick<ChunkTranslations, 'locales'>
): TranslationsTable {
  return gtFiles.output
    ? loadTranslationFiles(gtFiles.output, build.locales)
    : {};
}

// gt-react's getFileUrl() reads files by the same name
function getFileName(key: string, locale: string, hash: string): string {
  return `${key}.${locale}.${hash}.json`;
}

/**
 * Called once the bundler has written its chunks: emits the translation
 * files and the manifest. Returns what writes the startup script of each
 * entry chunk, by its file, the locales without a translations file, the
 * unsplit files it wrote, and the chunks whose dynamic import needs a file.
 *
 * A dynamic import loads the chunk its final code names, through the chunk
 * import map when the build has one, so those chunks are import targets next
 * to the ones the bundler reports. The build fails when the lists it is
 * about to write leave a load without a message it runs (see
 * findUncoveredChunkMessages).
 */
export function writeChunkTranslations(
  bundle: Record<string, BundleFile>,
  build: ChunkTranslations,
  {
    gtFiles,
    base,
    assetsDir,
    emitFile,
  }: {
    gtFiles: GTOutputFileConfig;
    /** The URL the build's files are served from */
    base: string;
    /** Where the manifest goes, inside the output directory */
    assetsDir: string;
    emitFile: (file: {
      type: 'asset';
      fileName: string;
      source: string;
    }) => unknown;
  }
): {
  startupScripts: Map<string, (base: string) => string>;
  missingLocales: string[];
  unsplit: { locale: string; count: number; bytes: number }[];
  imported: Set<string>;
  /** Whether loading the first chunk loads the second, as one it imports statically */
  isLoadedWith: (chunk: string, other: string) => boolean;
  /** The translation files at `files.gt.output` that are modules of the build */
  bundledCatalogs: string[];
} {
  const chunks = Object.values(bundle).filter(
    (
      file
    ): file is BundleFile & Omit<AssignedChunk, 'hashes'> & { code: string } =>
      file.type === 'chunk' && typeof file.code === 'string'
  );
  const importMap = readChunkImportMap(bundle, build.importMap);
  const table = loadChunkTranslationsTable(gtFiles, build);
  const assigned: AssignedChunk[] = chunks.map(
    ({ fileName, code, imports, dynamicImports, isEntry }) => {
      const loaded = findImportedChunks({ fileName, code }, importMap).filter(
        (file) => bundle[file]?.type === 'chunk'
      );
      return {
        fileName,
        hashes: findChunkHashes(code, build.hashes),
        imports,
        dynamicImports: [...new Set([...dynamicImports, ...loaded])],
        isEntry,
      };
    }
  );
  const assignment = { ...assignTranslationsByChunk(assigned), importMap };
  const uncovered = findUncoveredChunkMessages(
    assigned,
    assignment,
    renderImportedFiles(assignment.imports, importMap)
  );
  if (uncovered.length) {
    throw new Error(createUncoveredChunkMessagesError(uncovered));
  }
  const byFile = new Map(assigned.map((chunk) => [chunk.fileName, chunk]));
  const isLoadedWith = (chunk: string, other: string): boolean => {
    const reached = new Set<string>();
    const pending = [chunk];
    for (let file = pending.pop(); file; file = pending.pop()) {
      if (file === other) return true;
      if (reached.has(file)) continue;
      reached.add(file);
      pending.push(...(byFile.get(file)?.imports ?? []));
    }
    return false;
  };
  const { files, manifest, unsplit, startupScripts } = renderChunkTranslations(
    assignment,
    build,
    table,
    base,
    {
      key: path.posix.join(assetsDir, UNSPLIT_TRANSLATIONS_KEY),
      translations: getUnsplitTranslations(table, build),
    },
    build.naming === 'map'
      ? {
          key: path.posix.join(assetsDir, TRANSLATIONS_MAP_KEY),
          files: path.posix.join(assetsDir, CONTENT_FILES_KEY),
        }
      : undefined
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
    imported: new Set(
      [...assignment.imports]
        .filter(([, keys]) => keys.length)
        .map(([target]) => target)
    ),
    isLoadedWith,
    bundledCatalogs: findBundledCatalogs(chunks, gtFiles, build),
  };
}
