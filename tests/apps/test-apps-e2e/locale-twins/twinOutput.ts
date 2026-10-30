/**
 * App-agnostic helpers for checking locale twin builds: reading the build
 * output (manifest, report, document data), the entries each twin carries,
 * and turning translation files into the strings that must
 * (or must not) reach a visitor. Used by the Playwright specs and by each twin
 * test app's node-level build tests. At runtime it uses Node built-ins and
 * the locale twin contract (placeholder format) from generaltranslation; the
 * other build contract types come from the packages that own them.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  findLocaleTwinPlaceholders,
  serializeLocaleTwinValue,
} from 'generaltranslation/internal';
import type { Content, LocaleTwinManifest } from 'generaltranslation/types';
import type { LocaleTwinDocumentData } from 'gt-i18n/internal/locale-twins';

/** The twin manifest (`gt-locale-twins.json`). */
export type TwinManifest = LocaleTwinManifest;

/** An entry the build left unattributed (it keeps its source text in code). */
export type TwinReportUnattributedEntry = {
  file: string;
  line?: number;
  column?: number;
  api: string;
  reason: string;
};

/** The parts of `gt-locale-twins-report.json` the tests read. */
export type TwinReport = {
  defaultLocale: string;
  locales: string[];
  twinned: string[];
  shared: string[];
  missingTranslations: Record<string, string[]>;
  sharedBytes: number;
  twinnedBytes: number;
  twinBytes: Record<string, number>;
  outputMultiplier: number;
  /** Entry hashes each twinned file carries, by original file name. */
  entries: Record<string, string[]>;
  /** Bytes of the filled placeholder values, per locale and original file. */
  translationBytes: Record<string, Record<string, number>>;
  unattributed: TwinReportUnattributedEntry[];
  spa?: { bootstrap: string; documents: string[]; cspHash?: string };
};

/** Contents of the SPA document's `#gt-locale-twins-data` block. */
export type TwinDocumentData = LocaleTwinDocumentData;

/** A translation file's value: an ICU string or minified GT JSX. */
export type TranslationContent = unknown;
export type TranslationFile = Record<string, TranslationContent>;

export const TWIN_MANIFEST_FILE = 'gt-locale-twins.json';
export const TWIN_REPORT_FILE = 'gt-locale-twins-report.json';
/** Where the build writes its report, relative to the Vite root (not public). */
export const TWIN_REPORT_PATH = `node_modules/.cache/gt/${TWIN_REPORT_FILE}`;
const DOCUMENT_DATA_PATTERN =
  /<script\b[^>]*\bid=["']?gt-locale-twins-data["']?[^>]*>([\s\S]*?)<\/script\s*>/i;

/** An unfilled placeholder: the prefix followed by at least one hash. */
export const UNFILLED_PLACEHOLDER_PATTERN = /__GT_LOCALE_TWIN__:[0-9a-f]{16}/;

/** The shortest segment (in characters, trimmed) used in string checks. */
const MIN_SEGMENT_LENGTH = 3;

export function readTwinManifest(clientDir: string): TwinManifest {
  return readJson(path.join(clientDir, TWIN_MANIFEST_FILE)) as TwinManifest;
}

/** Reads the build report of the app whose Vite root is `rootDir`. */
export function readTwinReport(rootDir: string): TwinReport {
  return readJson(path.join(rootDir, TWIN_REPORT_PATH)) as TwinReport;
}

export function readTwinDocumentData(html: string): TwinDocumentData {
  const match = DOCUMENT_DATA_PATTERN.exec(html);
  if (!match) throw new Error('The document has no locale twin data block');
  return JSON.parse(match[1]) as TwinDocumentData;
}

/** Reads `[locale].json` for every locale (the default locale included). */
export function readTranslations(
  translationsDir: string,
  locales: string[]
): Record<string, TranslationFile> {
  return Object.fromEntries(
    locales.map((locale) => [
      locale,
      readJson(path.join(translationsDir, `${locale}.json`)) as TranslationFile,
    ])
  );
}

/** Every file below `dir`, as POSIX paths relative to it. */
export function listFiles(dir: string): string[] {
  const files: string[] = [];
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else files.push(path.relative(dir, absolute).split(path.sep).join('/'));
    }
  };
  walk(dir);
  return files.sort();
}

/** The twin file of `fileName` in `locale`. */
export function twinOf(
  manifest: TwinManifest,
  locale: string,
  fileName: string
): string {
  const twin = manifest.twins[locale]?.[fileName];
  if (!twin) throw new Error(`No ${locale} twin for ${fileName}`);
  return twin;
}

/**
 * The client files a visitor of `locale` can receive: that locale's twins,
 * every shared file (JS and others), and the documents. Originals of twinned
 * files and other locales' twins are excluded; so are source maps and the
 * twin manifest. (The build report is not in the client output.)
 */
export function servedFiles(
  clientDir: string,
  manifest: TwinManifest,
  locale: string
): string[] {
  const twinned = new Set(manifest.twinned);
  const allTwins = new Set(
    Object.values(manifest.twins).flatMap((twins) => Object.values(twins))
  );
  const ownTwins = new Set(Object.values(manifest.twins[locale] ?? {}));
  return listFiles(clientDir).filter((file) => {
    if (file === TWIN_MANIFEST_FILE) return false;
    if (file.endsWith('.map')) return false;
    if (twinned.has(file)) return false;
    if (allTwins.has(file)) return ownTwins.has(file);
    return true;
  });
}

/** The entries a twin carries (its call sites' filled placeholders). */
export type FilledTable = {
  locale: string;
  hashes: string[];
  /** UTF-8 bytes of the filled values (the inline translations). */
  bytes: number;
};

/**
 * The entries the served file `file` carries: for a locale twin, the hashes
 * of its call sites and the bytes of their inline content, from the build
 * report (inline values carry no hash, so the code alone cannot name them).
 * Shared files and documents carry none.
 */
export function twinTables(
  manifest: TwinManifest,
  report: TwinReport,
  file: string
): FilledTable[] {
  for (const [locale, twins] of Object.entries(manifest.twins)) {
    for (const [original, twin] of Object.entries(twins)) {
      if (twin !== file || !report.entries[original]) continue;
      return [
        {
          locale,
          hashes: report.entries[original],
          bytes: report.translationBytes[locale]?.[original] ?? 0,
        },
      ];
    }
  }
  return [];
}

/**
 * What each placeholder of an original twinned file becomes in `locale`'s
 * twin: `[locale, translation]`, or `[defaultLocale, source]` for the
 * default locale and for translations the locale lacks.
 */
export function expectedInlineValues(
  originalCode: string,
  locale: string,
  defaultLocale: string,
  translations: Record<string, TranslationFile>
): string[] {
  return findLocaleTwinPlaceholders(originalCode).map(({ hash, source }) => {
    const translation =
      locale === defaultLocale ? undefined : translations[locale]?.[hash];
    return translation === undefined
      ? serializeLocaleTwinValue(defaultLocale, source)
      : serializeLocaleTwinValue(locale, translation as Content);
  });
}

/**
 * The text a translation shows, as segments: ICU literal text (arguments
 * removed) and JSX text children, branch forms, and translated html content
 * props. Segments are trimmed and short ones dropped.
 */
export function textSegments(content: TranslationContent): string[] {
  return segmentAlternatives(content).flat();
}

/**
 * The segments of each way a translation can render: one list without
 * branches, one per combination of `<Plural>`/`<Branch>` forms.
 */
export function segmentAlternatives(content: TranslationContent): string[][] {
  if (typeof content === 'string') return [icuSegments(content)];
  if (Array.isArray(content)) return combine(content.map(segmentAlternatives));
  if (content && typeof content === 'object') {
    const element = content as {
      c?: TranslationContent;
      d?: { b?: Record<string, TranslationContent> } & Record<string, unknown>;
    };
    const props = Object.entries(element.d ?? {})
      .filter(([key, value]) => key !== 'b' && key !== 't' && value)
      .flatMap(([, value]) =>
        typeof value === 'string' ? icuSegments(value) : []
      );
    const children =
      element.c === undefined ? [[]] : segmentAlternatives(element.c);
    const branches = element.d?.b
      ? Object.values(element.d.b).flatMap(segmentAlternatives)
      : [[]];
    return combine([[props], children, branches]);
  }
  return [[]];
}

function combine(parts: string[][][]): string[][] {
  return parts.reduce<string[][]>(
    (combined, alternatives) =>
      combined.flatMap((prefix) =>
        alternatives.map((alternative) => [...prefix, ...alternative])
      ),
    [[]]
  );
}

function icuSegments(message: string): string[] {
  let text = message;
  // Remove arguments innermost first; select/plural bodies keep their text.
  for (;;) {
    const next = text.replace(/\{[^{}]*\}/g, '\u0000');
    if (next === text) break;
    text = next;
  }
  return text
    .split('\u0000')
    .map((segment) => segment.trim())
    .filter((segment) => [...segment].length >= MIN_SEGMENT_LENGTH);
}

/**
 * For each locale, the segments of the given entries that identify that
 * locale: segments that occur in no other locale's text. Checking a body for
 * these is unambiguous.
 */
export function distinctiveSegments(
  translations: Record<string, TranslationFile>,
  hashes: Iterable<string>
): Record<string, Record<string, string[]>> {
  const hashList = [...hashes];
  const segments = Object.fromEntries(
    Object.entries(translations).map(([locale, file]) => [
      locale,
      Object.fromEntries(
        hashList.map((hash) => {
          if (!(hash in file)) {
            throw new Error(`${locale}.json has no entry ${hash}`);
          }
          return [hash, textSegments(file[hash])];
        })
      ),
    ])
  );
  const allText = (except: string) =>
    Object.entries(segments)
      .filter(([locale]) => locale !== except)
      .flatMap(([, byHash]) => Object.values(byHash).flat());
  return Object.fromEntries(
    Object.entries(segments).map(([locale, byHash]) => {
      const others = allText(locale);
      return [
        locale,
        Object.fromEntries(
          Object.entries(byHash).map(([hash, list]) => [
            hash,
            list.filter(
              (segment) => !others.some((other) => other.includes(segment))
            ),
          ])
        ),
      ];
    })
  );
}

/**
 * The hashes the build attributed: the entries its twins carry (from the
 * build report). Entries of the translation files that are not attributed
 * (derived content) keep their source text in code and render untranslated.
 */
export function attributedHashes(report: TwinReport): Set<string> {
  return new Set(Object.values(report.entries).flat());
}

export type IsolationResult = {
  /** Segments of `locale` (by hash) missing from the text. */
  missing: { hash: string; segment: string }[];
  /** Segments of other locales found in the text. */
  foreign: { locale: string; hash: string; segment: string }[];
};

/**
 * Checks that `text` holds the given locale's segments for `expectedHashes`
 * and no segment of any other locale.
 */
export function checkIsolation(
  text: string,
  locale: string,
  segments: Record<string, Record<string, string[]>>,
  expectedHashes: Iterable<string> = []
): IsolationResult {
  const missing = [...expectedHashes].flatMap((hash) =>
    (segments[locale]?.[hash] ?? [])
      .filter((segment) => !text.includes(segment))
      .map((segment) => ({ hash, segment }))
  );
  const foreign = Object.entries(segments)
    .filter(([other]) => other !== locale)
    .flatMap(([other, byHash]) =>
      Object.entries(byHash).flatMap(([hash, list]) =>
        list
          .filter((segment) => text.includes(segment))
          .map((segment) => ({ locale: other, hash, segment }))
      )
    );
  return { missing, foreign };
}

/** Basenames of emitted JS files that `code` names in a string literal. */
export function referencedJsFiles(code: string, jsFiles: string[]): string[] {
  const byBasename = new Map(
    jsFiles.map((file) => [path.posix.basename(file), file])
  );
  const found = new Set<string>();
  for (const match of code.matchAll(
    /["'`]([^"'`\s]*?([^/"'`\s]+\.m?js))["'`]/g
  )) {
    const file = byBasename.get(match[2]);
    if (file) found.add(file);
  }
  return [...found].sort();
}

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/**
 * Hashes of the translation file entries that hold a `<Derive>` element:
 * derived content is hashed at runtime, so the compiler cannot attribute it
 * and reports it as unattributed (reason `derive`). The test apps use no
 * other kind of unattributed content.
 */
export function derivedEntryHashes(file: TranslationFile): Set<string> {
  return new Set(
    Object.entries(file)
      .filter(([, content]) => containsDerive(content))
      .map(([hash]) => hash)
  );
}

function containsDerive(content: TranslationContent): boolean {
  if (Array.isArray(content)) return content.some(containsDerive);
  if (!content || typeof content !== 'object') return false;
  const element = content as {
    t?: string;
    c?: TranslationContent;
    d?: { b?: Record<string, TranslationContent> };
  };
  return (
    element.t === 'Derive' ||
    containsDerive(element.c) ||
    Object.values(element.d?.b ?? {}).some(containsDerive)
  );
}

/**
 * Checks that the build attributed exactly the source translation file's
 * entries minus the unattributed ones its report lists: the derived entries,
 * one report entry each. A broken attribution therefore fails here instead of
 * silently shrinking the string lists the isolation checks use. Returns the
 * problems found (empty when the attribution is complete).
 */
export function checkAttribution({
  source,
  attributed,
  report,
}: {
  /** The default locale's translation file. */
  source: TranslationFile;
  attributed: Set<string>;
  report: TwinReport;
}): string[] {
  const derived = derivedEntryHashes(source);
  const problems: string[] = [];
  for (const hash of Object.keys(source)) {
    if (!derived.has(hash) && !attributed.has(hash)) {
      problems.push(
        `${hash} is in the translation files but no twin carries it`
      );
    }
  }
  for (const hash of attributed) {
    if (!(hash in source)) {
      problems.push(`${hash} is in a twin but not in the translation files`);
    }
    if (derived.has(hash)) {
      problems.push(`${hash} is derived content but a twin carries it`);
    }
  }
  const reported = report.unattributed ?? [];
  if (reported.length !== derived.size) {
    problems.push(
      `the report lists ${reported.length} unattributed entries, the translation files have ${derived.size} derived entries`
    );
  }
  for (const entry of reported) {
    if (entry.reason !== 'derive') {
      problems.push(`unexpected unattributed entry ${JSON.stringify(entry)}`);
    }
  }
  return problems;
}
