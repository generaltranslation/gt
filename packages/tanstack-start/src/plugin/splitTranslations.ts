// The build's side of split translations. The compiler splits the
// translations of the client build only. This plugin hands what that build wrote to the server build, which
// TanStack Start runs after it with the same plugin instances, and points the
// runtime at its split-aware modules.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import type { SplitStartState, SplitTable } from '../split/types';

export const SPLIT_MODULE_ID = 'gt-tanstack-start/internal/splitTranslations';
const SPLIT_TABLE_MODULE_ID = 'gt-tanstack-start/internal/_split-table';
const RESOLVED_SPLIT_TABLE_MODULE_ID = '\0gt-tanstack-start:split-table';
const SPLIT_CONTENTS_MODULE_ID = '\0gt-tanstack-start:split-contents:';
// The compiler's CHUNK_TRANSLATIONS_MANIFEST
const MANIFEST = 'gt-chunk-translations.json';
// What the table and the content of each locale's files are in the server's
// modules until every module of the server build is compiled
const TABLE_PLACEHOLDER = '__GT_SPLIT_TABLE__';
const CONTENTS_PLACEHOLDER = '__GT_SPLIT_CONTENTS__:';
const TABLE_STRING = new RegExp(`(["'\`])${TABLE_PLACEHOLDER}\\1`, 'g');
const CONTENTS_STRING = new RegExp(
  `(["'\`])${CONTENTS_PLACEHOLDER}([A-Za-z0-9_-]+)\\1`,
  'g'
);

const ENV_TRUE_VALUES = new Set(['true', '1']);

export type SplitFirstVisit = SplitTable['firstVisit'];

/** The compiler's manifests of both splits, as far as this plugin reads them. */
type Manifest = {
  split?: 'module';
  locales: string[];
  entries: Record<
    string,
    { translations?: Record<string, string>; files?: string[] }
  >;
  files: Record<string, Record<string, string>>;
  imports: Record<string, string[]>;
  unsplit?: Record<string, string>;
  maps?: Record<string, string>;
  current?: string;
};

/**
 * Whether the compiler splits translations: its own rule for
 * `experimentalSplitTranslations.enabled` and `GT_SPLIT_TRANSLATIONS`.
 */
export function isSplitEnabled(
  option: { enabled?: boolean } | false | null | undefined
): boolean {
  const raw = process.env.GT_SPLIT_TRANSLATIONS?.trim().toLowerCase();
  return (
    (option || undefined)?.enabled ??
    (raw ? ENV_TRUE_VALUES.has(raw) : undefined) ??
    Boolean(option)
  );
}

/** Whether a plugin hook runs in a Vite environment built for a server. */
export function isServerEnvironment(context: unknown): boolean {
  return (
    (context as { environment?: { config?: { consumer?: string } } })
      .environment?.config?.consumer === 'server'
  );
}

// `<key>.<locale>.<hash>.json`, as the compiler's getFileName() writes it
function readHash(fileName: string, key: string, locale: string): string {
  return fileName.slice(`${key}.${locale}.`.length, -'.json'.length);
}

function readKey(fileName: string, locale: string): string {
  const end = fileName.lastIndexOf(`.${locale}.`);
  return fileName.slice(0, end);
}

/** What the server build reads, from what the client build wrote into `outDir`. */
export function createSplitTable(
  outDir: string,
  assetsDir: string,
  base: string,
  firstVisit: SplitFirstVisit
): { table: SplitTable; contents: Record<string, Record<string, string>> } {
  const read = (fileName: string) =>
    fs.readFileSync(path.join(outDir, fileName), 'utf8');
  const manifest = JSON.parse(
    read(path.posix.join(assetsDir, MANIFEST))
  ) as Manifest;
  const [[entryChunk, entry] = ['', undefined]] = Object.entries(
    manifest.entries
  );
  const current = manifest.current
    ? (JSON.parse(read(manifest.current)) as { c?: string })
    : undefined;
  const table: SplitTable = {
    firstVisit,
    split: manifest.split ?? 'chunk',
    base,
    states: {},
    imports: manifest.imports,
    files: manifest.files,
    entry: (manifest.split ? manifest.maps : entry?.translations) ?? {},
    entryChunk,
    entryKeys: entry?.files ?? [],
    unsplit: manifest.unsplit ?? {},
  };
  const contents: Record<string, Record<string, string>> = {};
  for (const locale of manifest.locales) {
    const entryFile = table.entry[locale];
    if (entryFile === undefined) continue;
    const entryKey = readKey(entryFile, locale);
    const unsplit = table.unsplit[locale];
    // A file of a build that splits by chunk is named by the locale's token
    const [tokenFile] = Object.entries(manifest.files).flatMap(([key, names]) =>
      names[locale] ? [[key, names[locale]]] : []
    );
    const state: SplitStartState = {
      b: base,
      f: entryKey,
      h: { [locale]: readHash(entryFile, entryKey, locale) },
      v:
        manifest.split || !tokenFile
          ? {}
          : { [locale]: readHash(tokenFile[1], tokenFile[0], locale) },
      ...(manifest.split && {
        e: {
          [locale]: Object.fromEntries(
            table.entryKeys.flatMap((key) =>
              manifest.files[key]?.[locale]
                ? [[key, readHash(manifest.files[key][locale], key, locale)]]
                : []
            )
          ),
        },
      }),
      ...(manifest.current && {
        n: manifest.current.slice(0, -'.json'.length),
        ...(current?.c !== undefined && { c: current.c }),
      }),
      ...(unsplit && {
        u: readKey(unsplit, locale),
        o: { [locale]: readHash(unsplit, readKey(unsplit, locale), locale) },
      }),
    };
    table.states[locale] = state;
    if (firstVisit !== 'inline') continue;
    const names = [
      entryFile,
      unsplit,
      ...Object.values(manifest.files).map((byLocale) => byLocale[locale]),
    ].filter((name): name is string => name !== undefined);
    contents[locale] = Object.fromEntries(
      [...new Set(names)].map((name) => [name, read(name)])
    );
  }
  return { table, contents };
}

/**
 * Takes the translations of `hashes` out of the unsplit file of each locale
 * in the client build at `outDir`, and names each changed file by what it
 * now holds. The compiler puts every translation that no chunk's file holds
 * into those files, which every page loads, and that includes the messages
 * only the server's code uses.
 */
export function dropUnsplitTranslations(
  outDir: string,
  assetsDir: string,
  hashes: readonly string[]
): void {
  const manifestFile = path.join(outDir, assetsDir, MANIFEST);
  const manifest = JSON.parse(
    fs.readFileSync(manifestFile, 'utf8')
  ) as Manifest;
  if (!hashes.length || !manifest.unsplit) return;
  for (const [locale, fileName] of Object.entries(manifest.unsplit)) {
    const file = path.join(outDir, fileName);
    const translations = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<
      string,
      unknown
    >;
    const kept = Object.fromEntries(
      Object.entries(translations).filter(([hash]) => !hashes.includes(hash))
    );
    const count = Object.keys(kept).length;
    if (count === Object.keys(translations).length) continue;
    fs.rmSync(file);
    delete manifest.unsplit[locale];
    if (!count) continue;
    // As the compiler's getFileHash() and getFileName() name it
    const source = JSON.stringify(kept);
    const hash = createHash('sha256').update(source).digest('hex').slice(0, 8);
    const key = readKey(fileName, locale);
    manifest.unsplit[locale] = `${key}.${locale}.${hash}.json`;
    fs.writeFileSync(path.join(outDir, manifest.unsplit[locale]), source);
  }
  if (!Object.keys(manifest.unsplit).length) delete manifest.unsplit;
  fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
}

/**
 * @param getServerOnlyHashes The hashes of the messages only server code uses, known once the server build has compiled its modules.
 */
export function createSplitPlugin(
  firstVisit: SplitFirstVisit,
  getServerOnlyHashes: () => string[]
): Plugin {
  let isBuild = false;
  let base = '/';
  let assetsDir = 'assets';
  let clientDir: string | undefined;
  let written: ReturnType<typeof createSplitTable> | undefined;
  const isActive = () => isBuild && process.env.NODE_ENV === 'production';
  return {
    name: 'gt-tanstack-start:split-translations',
    enforce: 'pre',
    configResolved(config) {
      isBuild = config.command === 'build';
      base = config.base;
      assetsDir = config.build.assetsDir;
    },
    resolveId(id, importer) {
      if (!isActive()) return;
      if (id === SPLIT_MODULE_ID) {
        return this.resolve(
          `${SPLIT_MODULE_ID}.${isServerEnvironment(this) ? 'server' : 'client'}`,
          importer,
          { skipSelf: true }
        );
      }
      if (
        id === SPLIT_TABLE_MODULE_ID &&
        isServerEnvironment(this) &&
        written
      ) {
        return RESOLVED_SPLIT_TABLE_MODULE_ID;
      }
      if (id.startsWith(SPLIT_CONTENTS_MODULE_ID)) return id;
    },
    load(id) {
      if (id === RESOLVED_SPLIT_TABLE_MODULE_ID && written) {
        const locales = Object.keys(written.contents);
        return [
          `export const table = ${JSON.stringify(TABLE_PLACEHOLDER)};`,
          `export const loadContents = {${locales
            .map(
              (locale) =>
                `${JSON.stringify(locale)}: () => import(${JSON.stringify(SPLIT_CONTENTS_MODULE_ID + locale)})`
            )
            .join(', ')}};`,
        ].join('\n');
      }
      if (id.startsWith(SPLIT_CONTENTS_MODULE_ID) && written) {
        const locale = id.slice(SPLIT_CONTENTS_MODULE_ID.length);
        return `export default ${JSON.stringify(CONTENTS_PLACEHOLDER + locale)};`;
      }
    },
    // Every module of the server build is compiled by now, so which messages
    // only the server uses is known: the client's unsplit files lose them,
    // and the server's modules get the table of the files as they then are.
    generateBundle(_options, bundle) {
      if (!isActive() || !isServerEnvironment(this) || !clientDir) return;
      dropUnsplitTranslations(clientDir, assetsDir, getServerOnlyHashes());
      const { table, contents } = createSplitTable(
        clientDir,
        assetsDir,
        base,
        firstVisit
      );
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue;
        chunk.code = chunk.code
          .replace(TABLE_STRING, () => JSON.stringify(table))
          .replace(
            CONTENTS_STRING,
            (_match, _quote, locale: string) =>
              `{${Object.entries(contents[locale] ?? {})
                .map(
                  ([name, source]) =>
                    `${JSON.stringify(name)}: JSON.parse(${JSON.stringify(source)})`
                )
                .join(',\n')}}`
          );
      }
    },
    // The client build is written before the server build starts
    writeBundle(options) {
      if (!isActive() || isServerEnvironment(this) || !options.dir) return;
      if (!fs.existsSync(path.join(options.dir, assetsDir, MANIFEST))) return;
      clientDir = options.dir;
      written = createSplitTable(options.dir, assetsDir, base, firstVisit);
    },
  };
}
