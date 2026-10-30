import { createHash } from 'node:crypto';
import type { EncodedSourceMap } from '@jridgewell/trace-mapping';
import { parse } from '@babel/parser';
import MagicString from 'magic-string';
import { composeSourceMaps } from './composeSourceMaps';
import {
  createInvalidTwinLocaleDiagnostic,
  createUnparsableChunkDiagnostic,
  createMissingTranslationsDiagnostic,
  type MissingLocaleTwinTranslations,
} from './diagnostics';
import {
  findLocaleTwinPlaceholders,
  LOCALE_TWIN_MANIFEST_VERSION,
  serializeLocaleTwinTable,
  type LocaleTwinEntries,
  type LocaleTwinManifest,
  type LocaleTwinPlaceholderMatch,
  type LocaleTwinTable,
} from 'generaltranslation/internal';

/** A v3 source map as JSON text or an object (e.g. Rollup's `chunk.map`). */
export type LocaleTwinSourceMap = string | EncodedSourceMap;

/** One emitted output file, keyed by its outDir-relative POSIX file name. */
export type LocaleTwinInputFile = {
  code: string;
  /** The file's source map, when the build emits one. */
  map?: LocaleTwinSourceMap | null;
};

export type GenerateLocaleTwinsInput = {
  /** Emitted client output files keyed by outDir-relative POSIX file name. */
  files: Record<string, LocaleTwinInputFile>;
  /** File names of the build's entry chunks (`chunk.isEntry`). */
  entries?: string[];
  defaultLocale: string;
  /** Locales to twin. The default locale is always included. */
  locales: string[];
  /** Translations per locale (`[locale].json` contents: hash → content). */
  translations: Record<string, LocaleTwinEntries | undefined>;
  /**
   * `'warn'` (default): missing translations fall back to the source text and
   * are reported. `'error'`: throw a diagnostic instead.
   */
  missingTranslations?: 'warn' | 'error';
  /**
   * The manifest written by the previous run into the same output directory.
   * Its twins are ignored as input, and those not regenerated are deleted.
   */
  previousManifest?: LocaleTwinManifest;
};

export type LocaleTwinReport = {
  /** Original file names of twinned JS files, sorted. */
  twinned: string[];
  /** JS files identical for every locale (emitted once), sorted. */
  shared: string[];
  /** Hashes with no translation, per non-default locale; only locales with any. */
  missingTranslations: MissingLocaleTwinTranslations;
  /** Number of placeholder literals filled (per locale). */
  placeholders: number;
  /** UTF-8 bytes of the shared JS files. */
  sharedBytes: number;
  /** UTF-8 bytes of the original twinned JS files. */
  twinnedBytes: number;
  /** UTF-8 bytes of each locale's twins (code only, no maps). */
  twinBytes: Record<string, number>;
  /**
   * Served JS output after twinning over JS output without it:
   * `(shared + Σ twins of every locale) / (shared + twinned)`. Roughly the
   * locale count when everything is twinned, close to 1 when little is.
   */
  outputMultiplier: number;
};

export type GenerateLocaleTwinsResult = {
  /** Files to write, keyed by outDir-relative POSIX file name. */
  files: Record<string, string>;
  /**
   * Files from the previous run to delete (twins listed in the previous
   * manifest that this run did not regenerate, and their `.map` files), sorted.
   * They may not exist; ignore missing files.
   */
  deletions: string[];
  manifest: LocaleTwinManifest;
  report: LocaleTwinReport;
};

/** A reference to another emitted JS file: the span of its basename in code. */
type FileReference = {
  start: number;
  end: number;
  target: string;
};

/** A trailing `//# sourceMappingURL=<url>` comment. */
type SourceMapComment = {
  /** Offset of `//`. */
  start: number;
  /** Span of the URL. */
  urlStart: number;
  urlEnd: number;
  inline: boolean;
};

type ScannedFile = {
  fileName: string;
  code: string;
  map: LocaleTwinSourceMap | undefined;
  placeholders: LocaleTwinPlaceholderMatch[];
  references: FileReference[];
  sourceMapComment: SourceMapComment | undefined;
};

type TwinnedFile = ScannedFile;

/**
 * Generates locale twins for a client build output. Pure: reads only its
 * input and returns the files to write, without touching the file system.
 */
export function generateLocaleTwins(
  input: GenerateLocaleTwinsInput
): GenerateLocaleTwinsResult {
  const locales = resolveLocales(input);
  const previousTwins = new Set(
    Object.values(input.previousManifest?.twins ?? {}).flatMap((fileMap) =>
      Object.values(fileMap)
    )
  );
  const scanned = scanFiles(
    Object.keys(input.files).filter((name) => !previousTwins.has(name)),
    input.files
  );
  const twinnedNames = findClosure(scanned);
  const twinned: TwinnedFile[] = scanned.filter((file) =>
    twinnedNames.has(file.fileName)
  );
  const shared = scanned.filter((file) => !twinnedNames.has(file.fileName));
  const sharedBytes = sum(shared.map((file) => byteLength(file.code)));
  const twinnedBytes = sum(twinned.map((file) => byteLength(file.code)));
  const twinBytes: Record<string, number> = {};

  const files: Record<string, string> = {};
  const versions: Record<string, string> = {};
  const twins: Record<string, Record<string, string>> = {};

  const missingTranslations = findMissingTranslations(twinned, locales, input);
  if (
    input.missingTranslations === 'error' &&
    Object.keys(missingTranslations).length > 0
  ) {
    throw new Error(
      createMissingTranslationsDiagnostic(missingTranslations, 'Error')
    );
  }

  for (const locale of locales) {
    const tables = new Map<string, string[]>();
    const filledCode = new Map<string, string>();
    for (const file of twinned) {
      const fileTables = file.placeholders.map((match) =>
        serializeLocaleTwinTable(tableForLocale(match, locale, input))
      );
      tables.set(file.fileName, fileTables);
      filledCode.set(file.fileName, fillPlaceholders(file, fileTables));
    }
    const version = computeVersion(filledCode);
    versions[locale] = version;
    const localeTwins: Record<string, string> = {};
    for (const file of twinned) {
      localeTwins[file.fileName] = twinFileName(file.fileName, locale, version);
    }
    twins[locale] = localeTwins;
    for (const file of twinned) {
      writeTwin(
        file,
        localeTwins[file.fileName],
        tables.get(file.fileName)!,
        localeTwins,
        files
      );
    }
    twinBytes[locale] = sum(
      Object.values(localeTwins).map((name) => byteLength(files[name]))
    );
  }

  const deletions = [...previousTwins]
    .filter((name) => files[name] === undefined)
    .flatMap((name) => [name, `${name}.map`])
    .sort(compare);

  return {
    files,
    deletions,
    manifest: {
      version: LOCALE_TWIN_MANIFEST_VERSION,
      defaultLocale: input.defaultLocale,
      locales,
      twinned: twinned.map((file) => file.fileName),
      entries: (input.entries ?? [])
        .filter((name) => twinnedNames.has(name))
        .sort(compare),
      versions,
      twins,
    },
    report: {
      twinned: twinned.map((file) => file.fileName),
      shared: shared.map((file) => file.fileName),
      missingTranslations,
      placeholders: twinned.reduce(
        (count, file) => count + file.placeholders.length,
        0
      ),
      sharedBytes,
      twinnedBytes,
      twinBytes,
      outputMultiplier:
        sharedBytes + twinnedBytes === 0
          ? 1
          : (sharedBytes + sum(Object.values(twinBytes))) /
            (sharedBytes + twinnedBytes),
    },
  };
}

/**
 * Writes one twin (and its map) into `files`: placeholders filled, references
 * to twinned files renamed to this locale's twins, and the map comment pointed
 * at the twin's own map (or dropped when the original has no map).
 */
function writeTwin(
  file: TwinnedFile,
  twinName: string,
  tables: string[],
  localeTwins: Record<string, string>,
  files: Record<string, string>
): void {
  const code = new MagicString(file.code);
  file.placeholders.forEach((match, index) => {
    code.overwrite(match.start, match.end, tables[index]);
  });
  for (const reference of file.references) {
    const twin = localeTwins[reference.target];
    if (twin !== undefined) {
      code.overwrite(reference.start, reference.end, basename(twin));
    }
  }

  const comment = file.sourceMapComment;
  if (file.map === undefined) {
    if (comment) code.remove(comment.start, comment.urlEnd);
    files[twinName] = code.toString();
    return;
  }

  const mapJson = composeSourceMaps(
    code.generateDecodedMap({ hires: 'boundary' }),
    file.map,
    basename(twinName)
  );
  if (comment?.inline) {
    code.overwrite(
      comment.urlStart,
      comment.urlEnd,
      `data:application/json;charset=utf-8;base64,${Buffer.from(mapJson).toString('base64')}`
    );
  } else {
    if (comment) {
      code.overwrite(
        comment.urlStart,
        comment.urlEnd,
        `${basename(twinName)}.map`
      );
    }
    files[`${twinName}.map`] = mapJson;
  }
  files[twinName] = code.toString();
}

const JS_FILE = /\.m?js$/;

const SOURCE_MAP_COMMENT = /\/\/[#@] sourceMappingURL=(\S+)\s*$/;

/**
 * The whole value of a string literal that references a JS file: a path
 * ending in a JS file name, `./x.js`, `assets/x.js`, `/base/assets/x.js`.
 * File and directory names may contain spaces (Rollup keeps them, as in
 * `chunkFileNames: 'lazy pages/[name].js'`). Group 1 is the directory
 * prefix, group 2 the basename.
 */
const REFERENCE_PATTERN = /^((?:[^'"`\\]*\/)?)([^'"`\\/]+\.m?js)$/;

/** Scans every emitted JS file for placeholders and references, sorted by name. */
function scanFiles(
  fileNames: string[],
  files: Record<string, LocaleTwinInputFile>
): ScannedFile[] {
  const jsNames = fileNames.filter((name) => JS_FILE.test(name));
  const byBasename = new Map<string, string[]>();
  for (const fileName of jsNames) {
    const name = basename(fileName);
    byBasename.set(name, [...(byBasename.get(name) ?? []), fileName]);
  }
  return jsNames.sort(compare).map((fileName) => {
    const { code, map } = files[fileName];
    return {
      fileName,
      code,
      map: map ?? undefined,
      placeholders: findLocaleTwinPlaceholders(code),
      references: findReferences(fileName, code, byBasename),
      sourceMapComment: findSourceMapComment(code),
    };
  });
}

function findSourceMapComment(code: string): SourceMapComment | undefined {
  const match = SOURCE_MAP_COMMENT.exec(code);
  if (!match) return undefined;
  const urlStart = match.index + match[0].indexOf(match[1]);
  return {
    start: match.index,
    urlStart,
    urlEnd: urlStart + match[1].length,
    inline: match[1].startsWith('data:'),
  };
}

/**
 * Finds the string literals (any quote style, or a template literal without
 * expressions) whose whole value is a path to an emitted JS file, and the
 * last chunk of a template literal with expressions that ends in one (a
 * runtime URL, `${base}/assets/x.js`, from Vite's `renderBuiltUrl`). Text
 * that merely mentions a file name (in a longer string or a comment) is not
 * a reference. The code is tokenized, not parsed into an AST.
 */
function findReferences(
  importer: string,
  code: string,
  byBasename: Map<string, string[]>
): FileReference[] {
  // Most files (vendor code) name no emitted file: skip tokenizing them
  if (![...byBasename.keys()].some((name) => code.includes(name))) return [];
  let tokens: Array<{ type: { label: string }; start: number; end: number }>;
  try {
    tokens = parse(code, {
      sourceType: 'module',
      tokens: true,
      allowReturnOutsideFunction: true,
      allowAwaitOutsideFunction: true,
    }).tokens as typeof tokens;
  } catch (error) {
    throw new Error(createUnparsableChunkDiagnostic(importer, error));
  }
  const references: FileReference[] = [];
  for (const token of tokens) {
    let valueStart: number;
    let valueEnd: number;
    if (token.type.label === 'string') {
      valueStart = token.start + 1;
      valueEnd = token.end - 1;
    } else if (token.type.label === 'template' && code[token.end] === '`') {
      valueStart = token.start;
      valueEnd = token.end;
    } else {
      continue;
    }
    // The raw text: emitted chunk paths contain no escapes
    const match = REFERENCE_PATTERN.exec(code.slice(valueStart, valueEnd));
    if (!match) continue;
    const [, prefix, name] = match;
    const target = resolveReference(
      importer,
      prefix + name,
      byBasename.get(name),
      // Prose ("Loaded from ./x.js") is a reference only if it is a path
      /\s/.test(prefix)
    );
    if (target === undefined) continue;
    const start = valueStart + prefix.length;
    references.push({ start, end: start + name.length, target });
  }
  return references;
}

/**
 * Resolves a referenced path to an emitted file. A unique basename wins
 * (chunk-relative imports, base-relative preload lists and base-prefixed URLs
 * all end in it) unless `byPath`; duplicates are disambiguated by path.
 */
function resolveReference(
  importer: string,
  path: string,
  candidates: string[] | undefined,
  byPath: boolean
): string | undefined {
  if (!candidates) return undefined;
  if (candidates.length === 1 && !byPath) return candidates[0];
  const resolved = path.startsWith('.')
    ? joinPath(dirname(importer), path)
    : path.replace(/^\/+/, '');
  return (
    candidates.find((candidate) => candidate === resolved) ??
    candidates.find((candidate) => resolved.endsWith(`/${candidate}`))
  );
}

/**
 * Seeds with every file holding a placeholder, then repeatedly adds every
 * file that references a twinned file, until nothing is added.
 */
function findClosure(files: ScannedFile[]): Set<string> {
  const importers = new Map<string, string[]>();
  for (const file of files) {
    for (const { target } of file.references) {
      if (target === file.fileName) continue;
      importers.set(target, [...(importers.get(target) ?? []), file.fileName]);
    }
  }
  const twinned = new Set(
    files
      .filter((file) => file.placeholders.length > 0)
      .map((file) => file.fileName)
  );
  const queue = [...twinned];
  while (queue.length > 0) {
    for (const importer of importers.get(queue.pop()!) ?? []) {
      if (twinned.has(importer)) continue;
      twinned.add(importer);
      queue.push(importer);
    }
  }
  return twinned;
}

function basename(fileName: string): string {
  return fileName.slice(fileName.lastIndexOf('/') + 1);
}

function dirname(fileName: string): string {
  const index = fileName.lastIndexOf('/');
  return index === -1 ? '' : fileName.slice(0, index);
}

function joinPath(dir: string, path: string): string {
  const parts = dir ? dir.split('/') : [];
  for (const part of path.split('/')) {
    if (part === '..') parts.pop();
    else if (part !== '.' && part !== '') parts.push(part);
  }
  return parts.join('/');
}

/** Locale codes become part of twin file names. */
const FILE_NAME_SAFE_LOCALE = /^[A-Za-z0-9_-]+$/;

/** The default locale first, then the other locales once each, in input order. */
function resolveLocales(input: GenerateLocaleTwinsInput): string[] {
  const locales = [input.defaultLocale, ...input.locales].filter(
    (locale, index, all) => all.indexOf(locale) === index
  );
  const invalid = locales.filter(
    (locale) => !FILE_NAME_SAFE_LOCALE.test(locale)
  );
  if (invalid.length > 0) {
    throw new Error(createInvalidTwinLocaleDiagnostic(invalid));
  }
  return locales;
}

function findMissingTranslations(
  twinned: TwinnedFile[],
  locales: string[],
  input: GenerateLocaleTwinsInput
): MissingLocaleTwinTranslations {
  const hashes = new Set(
    twinned.flatMap((file) => file.placeholders.flatMap((m) => m.hashes))
  );
  const missing: MissingLocaleTwinTranslations = {};
  for (const locale of locales) {
    if (locale === input.defaultLocale) continue;
    const translations = input.translations[locale] ?? {};
    const localeMissing = [...hashes]
      .filter((hash) => translations[hash] === undefined)
      .sort(compare);
    if (localeMissing.length > 0) missing[locale] = localeMissing;
  }
  return missing;
}

/**
 * A placeholder's table for `locale`: its translations, with the source text
 * (listed in `s`) for hashes the locale has no translation for.
 */
function tableForLocale(
  match: LocaleTwinPlaceholderMatch,
  locale: string,
  input: GenerateLocaleTwinsInput
): LocaleTwinTable {
  if (locale === input.defaultLocale) return { l: locale, e: match.entries };
  const translations = input.translations[locale] ?? {};
  const entries: LocaleTwinEntries = {};
  const sourceFallbacks: string[] = [];
  for (const hash of match.hashes) {
    const translation = translations[hash];
    if (translation === undefined) sourceFallbacks.push(hash);
    entries[hash] = translation ?? match.entries[hash];
  }
  return sourceFallbacks.length > 0
    ? { l: locale, e: entries, s: sourceFallbacks }
    : { l: locale, e: entries };
}

/** The file's code with placeholders filled and references not yet renamed. */
function fillPlaceholders(file: TwinnedFile, tables: string[]): string {
  let code = '';
  let cursor = 0;
  file.placeholders.forEach((match, index) => {
    code += file.code.slice(cursor, match.start) + tables[index];
    cursor = match.end;
  });
  return code + file.code.slice(cursor);
}

/** First 8 hex of sha256 over the locale's sorted file names and filled code. */
function computeVersion(filledCode: Map<string, string>): string {
  const hash = createHash('sha256');
  for (const fileName of [...filledCode.keys()].sort(compare)) {
    hash.update(fileName).update('\0').update(filledCode.get(fileName)!);
    hash.update('\0');
  }
  return hash.digest('hex').slice(0, 8);
}

/** `assets/index-abc.js` → `assets/index-abc.fr-1a2b3c4d.js` */
function twinFileName(
  fileName: string,
  locale: string,
  version: string
): string {
  const extension = /\.[^./]+$/.exec(fileName)?.[0] ?? '';
  const stem = fileName.slice(0, fileName.length - extension.length);
  return `${stem}.${locale}-${version}${extension}`;
}

function byteLength(text: string): number {
  return Buffer.byteLength(text, 'utf8');
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
