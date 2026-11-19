import { createDiagnosticMessage } from 'generaltranslation/diagnostics';

/**
 * The chunk import map of a build, which Rolldown writes with
 * `experimental.chunkImportMap` (Vite's `build.chunkImportMap`): the file of
 * each chunk it names, by the name. Chunks then import each other, and
 * Vite's lists name them, by a name that stays the same when a chunk's
 * content changes, and the import map a page holds resolves it to the file
 * the bundler wrote, which is what the bundle knows a chunk by.
 *
 * A name is the path of a file as a chunk's is (`assets/Home-<hash>.js`),
 * with a hash that no file has, or a specifier that is not a path.
 */
export type ChunkImportMap = ReadonlyMap<string, string>;

/** Where a build writes its chunk import map. */
export type ChunkImportMapOptions = {
  /** The import map's file in the bundle */
  fileName: string;
  /** What starts every path in the import map */
  baseUrl: string;
};

// Rolldown's defaults for `experimental.chunkImportMap`
const ROLLDOWN_IMPORT_MAP_FILE = 'importmap.json';
const ROLLDOWN_IMPORT_MAP_BASE_URL = '/';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Where the build writes its chunk import map, read from the options the
 * bundler's `options` hook receives. Vite's `build.chunkImportMap` is there
 * as Rolldown's option, with Vite's `base`. Undefined when the build writes
 * none.
 */
export function getChunkImportMapOptions(
  inputOptions: unknown
): ChunkImportMapOptions | undefined {
  const experimental = isRecord(inputOptions)
    ? inputOptions.experimental
    : undefined;
  const setting = isRecord(experimental)
    ? experimental.chunkImportMap
    : undefined;
  if (!setting) return undefined;
  const { fileName, baseUrl } = isRecord(setting) ? setting : {};
  return {
    fileName:
      typeof fileName === 'string' && fileName
        ? fileName
        : ROLLDOWN_IMPORT_MAP_FILE,
    baseUrl:
      typeof baseUrl === 'string' ? baseUrl : ROLLDOWN_IMPORT_MAP_BASE_URL,
  };
}

export const createUnreadImportMapError = (fileName: string) =>
  createDiagnosticMessage({
    source: '@generaltranslation/compiler',
    severity: 'Error',
    whatHappened: `experimentalChunkTranslations could not read the chunk import map ${fileName}`,
    why: 'it is not an import map as the bundler writes one, so the build cannot tell which chunk a dynamic import loads',
    fix: "Turn off the bundler's chunk import map, or this option, and report this to General Translation",
  });

/**
 * Reads the chunk import map from the bundle. Undefined when the build
 * writes none, and when the bundle has none, as when no chunk has a hash in
 * its name. Throws when the file is not an import map.
 * @param written Where the build writes it, see getChunkImportMapOptions.
 */
export function readChunkImportMap(
  bundle: Readonly<Record<string, { type: string; source?: unknown }>>,
  written: ChunkImportMapOptions | undefined
): ChunkImportMap | undefined {
  if (!written) return undefined;
  const { fileName, baseUrl } = written;
  const asset = bundle[fileName];
  if (asset?.type !== 'asset' || asset.source === undefined) return undefined;
  let imports: unknown;
  try {
    const content: unknown = JSON.parse(
      typeof asset.source === 'string'
        ? asset.source
        : new TextDecoder().decode(asset.source as Uint8Array)
    );
    imports = isRecord(content) ? content.imports : undefined;
  } catch {
    // Reported below
  }
  const entries = isRecord(imports) ? Object.entries(imports) : undefined;
  if (
    !entries?.every(
      (entry): entry is [string, string] => typeof entry[1] === 'string'
    )
  ) {
    throw new Error(createUnreadImportMapError(fileName));
  }
  const withoutBase = (url: string) =>
    url.startsWith(baseUrl) ? url.slice(baseUrl.length) : url;
  return new Map(
    entries.map(([name, url]) => [withoutBase(name), withoutBase(url)])
  );
}

/**
 * Names chunks for a diagnostic: a chunk's file, and with a chunk import map
 * the names it is imported by, which are all that the build's code says of
 * it.
 */
export function describeChunks(
  importMap: ChunkImportMap | undefined
): (file: string) => string {
  const names = new Map<string, string[]>();
  for (const [name, file] of importMap ?? []) {
    if (name === file) continue;
    const known = names.get(file);
    if (known) known.push(name);
    else names.set(file, [name]);
  }
  return (file) => {
    const known = names.get(file);
    return known ? `${file} (imported as ${known.join(', ')})` : file;
  };
}
