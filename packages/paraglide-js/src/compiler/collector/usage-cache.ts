import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import zlib from 'node:zlib';
import type { ParsedSummary } from '../analysis/module-index.js';
import { packageVersions } from '../project/packages.js';
import { isJsonObject, parseJsonObject } from '../utils/json.js';
import { relativePath } from '../utils/paths.js';
import { compareText } from '../utils/sort.js';
import { writeFileAtomically } from '../utils/write-file.js';

/**
 * What a run found of each file, kept for the next run to skip what did not
 * change. It is kept in the project's `gt-lock.json`, which is committed: a
 * CI run starts from what the last committed run found.
 *
 * Every entry holds the hash of its file's content, and is used only while
 * the file still has it: a stale entry costs work, never a wrong result.
 */

export const LOCK_FILE = 'gt-lock.json';
export const SECTION = 'paraglide-usage-context';

/**
 * The format, and what the analysis finds: bump it when either changes, so
 * that every entry written before is left unused.
 */
const FORMAT = 1;

/**
 * Past it, the section would weigh on the lock file's reviews and merges: it
 * is kept in `FALLBACK_FILE` instead, which a CI cache can restore.
 */
export const MAX_LOCK_BYTES = 2_000_000;
export const FALLBACK_FILE = 'node_modules/.cache/paraglide-usage-context.json';

/**
 * Entries expand to less than 10 times their encoded length. One that would
 * expand further was not written here: it is not expanded, so a section
 * expands to at most this many times its size.
 */
const MAX_EXPANSION = 64;

export type CachedFile = {
  /** See `contentHash`. */
  hash: string;
  /** Unset for a file a language's tooling generates a module for: it is generated again. */
  summary?: ParsedSummary;
};

type Section = {
  version: number;
  fingerprint: string;
  /** By project-relative path: each an encoded `CachedFile`, on one line. */
  files: Record<string, string>;
};

/** The content's SHA-256, shortened: 64 bits tell files apart. */
export function contentHash(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex').slice(0, 16);
}

/**
 * What every entry depends on besides its file: the format, this package's
 * version and its dependencies', and the versions of the languages' tooling
 * in the project. An entry written with another fingerprint is not used.
 */
export async function cacheFingerprint(inputs: {
  /** The languages' tooling the project loads, as `name@version`. */
  tools: readonly string[];
  /** Anything else entries depend on, e.g. the auto-imported names. */
  settings: readonly string[];
}): Promise<string> {
  return contentHash(
    JSON.stringify([FORMAT, await ownVersions(), inputs.tools, inputs.settings])
  );
}

/**
 * This package's version, and the installed versions of its dependencies: a
 * new parser can change what the analysis finds as much as a new release.
 * See `packageVersions`.
 */
function ownVersions(): Promise<string[]> {
  // Above this module: in `src` or in `dist`.
  return packageVersions(
    fileURLToPath(import.meta.url),
    '@generaltranslation/paraglide-js'
  );
}

export class UsageCache {
  private readonly cached = new Map<string, CachedFile>();
  /** Each entry of `cached` as it was read: one that did not change is written as it was. */
  private readonly encoded = new Map<string, string>();
  private readonly found = new Map<string, CachedFile>();
  private readonly relatives = new Map<string, string>();

  private constructor(
    private readonly projectRoot: string,
    private readonly fingerprint: string
  ) {}

  /** The entries the project's lock file, or the fallback file, holds for `fingerprint`. */
  static load(projectRoot: string, fingerprint: string): UsageCache {
    const cache = new UsageCache(projectRoot, fingerprint);
    const section =
      readSection(path.join(projectRoot, LOCK_FILE)) ??
      readSection(path.join(projectRoot, FALLBACK_FILE));
    const isCurrent =
      section?.version === FORMAT && section.fingerprint === fingerprint;

    if (isCurrent) {
      for (const [file, encoded] of Object.entries(section.files)) {
        const entry = decodeEntry(encoded);
        if (!entry) continue;

        cache.cached.set(file, entry);
        cache.encoded.set(file, encoded);
      }
    }

    return cache;
  }

  /** What the last run found of `file`, absolute. */
  previous(file: string): CachedFile | undefined {
    return this.cached.get(this.relative(file));
  }

  /** What this run found of `file`: only what a run records is saved. */
  set(file: string, entry: CachedFile): void {
    this.found.set(this.relative(file), entry);
  }

  /**
   * Writes what this run found into the lock file, keeping everything else
   * in it, or into the fallback file if it is too large or there is no lock
   * file. Fails silently: the cache only saves time.
   */
  async save(maxLockBytes = MAX_LOCK_BYTES): Promise<void> {
    const files: Record<string, string> = {};

    for (const file of [...this.found.keys()].sort(compareText)) {
      const entry = this.found.get(file)!;
      const before = this.cached.get(file);

      // Compressing every entry again would take most of a warm run's time.
      files[file] =
        before && isDeepStrictEqual(before, entry)
          ? this.encoded.get(file)!
          : encodeEntry(entry);
    }

    const section: Section = {
      version: FORMAT,
      fingerprint: this.fingerprint,
      files,
    };
    const json = JSON.stringify(section);
    const lockFile = path.join(this.projectRoot, LOCK_FILE);
    const fallbackFile = path.join(this.projectRoot, FALLBACK_FILE);

    try {
      const fits = json.length <= maxLockBytes;
      // Not into a lock file that is not JSON, e.g. with conflict markers, or
      // that another process wrote meanwhile.
      const isLocked =
        (await updateJson(lockFile, fits ? section : undefined)) && fits;

      if (isLocked) {
        await fsp.rm(fallbackFile, { force: true });
      } else {
        await fsp.mkdir(path.dirname(fallbackFile), { recursive: true });
        await writeFileAtomically(fallbackFile, [
          Buffer.from(`{${JSON.stringify(SECTION)}:${json}}\n`),
        ]);
      }
    } catch {
      // The next run starts cold.
    }
  }

  relative(file: string): string {
    let relative = this.relatives.get(file);

    if (relative === undefined) {
      relative = relativePath(this.projectRoot, file);
      this.relatives.set(file, relative);
    }

    return relative;
  }
}

function readSection(file: string): Section | undefined {
  let text: string;

  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return undefined;
  }

  const section = parseJsonObject(text)?.[SECTION];
  const isSection = isJsonObject(section) && isJsonObject(section.files);

  return isSection ? (section as unknown as Section) : undefined;
}

/**
 * Sets the section of the lock file, or removes it, as the CLI writes it:
 * two spaces, a final newline. False if there is no lock file, it is not a
 * JSON object, or another process, e.g. `gt download`, wrote it meanwhile:
 * what that process wrote is kept.
 */
async function updateJson(
  file: string,
  section: Section | undefined
): Promise<boolean> {
  if (!fs.existsSync(file)) return false;

  const original = await fsp.readFile(file, 'utf8');
  const json = parseJsonObject(original);
  if (!json) return false;
  if (section === undefined && !(SECTION in json)) return true;

  if (section) json[SECTION] = section;
  else delete json[SECTION];

  const finalNewline = original.endsWith('\n') ? '\n' : '';
  const updated = `${JSON.stringify(json, null, 2)}${finalNewline}`;
  if (updated === original) return true;

  return writeFileAtomically(file, [Buffer.from(updated)], original);
}

/**
 * One line, whatever indentation writes the lock file: a diff shows one line
 * per file that changed. Compressed, as the entries are long and repetitive.
 */
function encodeEntry(entry: CachedFile): string {
  // JSON writes a typed array as an object.
  const summary = entry.summary?.map((part) => ({
    ...part,
    sites: part.sites && Array.from(part.sites),
  }));
  const json = JSON.stringify({ ...entry, summary });

  return zlib.deflateRawSync(json).toString('base64');
}

/** Undefined for an entry not written here, e.g. edited by hand. */
function decodeEntry(encoded: unknown): CachedFile | undefined {
  if (typeof encoded !== 'string') return undefined;

  try {
    const json = zlib
      .inflateRawSync(Buffer.from(encoded, 'base64'), {
        maxOutputLength: encoded.length * MAX_EXPANSION,
      })
      .toString();
    // Without a reviver: JSON.parse is several times as fast.
    const entry: unknown = JSON.parse(json);
    if (!isCachedFile(entry)) return undefined;

    for (const part of entry.summary ?? []) {
      if (part.sites) part.sites = Int32Array.from(part.sites);
    }

    return entry;
  } catch {
    return undefined;
  }
}

function isCachedFile(value: unknown): value is CachedFile {
  return (
    isJsonObject(value) &&
    typeof value.hash === 'string' &&
    (value.summary === undefined || isArrayOf(value.summary, isSummaryPart))
  );
}

/** As JSON carries a `ParsedSummary` part: its sites as an array. */
function isSummaryPart(value: unknown): boolean {
  if (!isJsonObject(value)) return false;

  const { specifiers, links, untrackedExports, exports, globalNames, sites } =
    value;

  return (
    isArrayOf(specifiers, isString) &&
    isArrayOf(links, isLink) &&
    typeof untrackedExports === 'string' &&
    (exports === undefined ||
      (isJsonObject(exports) &&
        typeof exports.names === 'string' &&
        isArrayOf(exports.stars, isString))) &&
    isArrayOf(globalNames, isString) &&
    (sites === undefined || isArrayOf(sites, Number.isInteger))
  );
}

/** See `SpecifierLinks`. */
function isLink(value: unknown): boolean {
  if (!isJsonObject(value) || typeof value.source !== 'string') return false;

  switch (value.type) {
    case 'import':
      return (
        isArrayOf(value.names, isString) && typeof value.namespace === 'boolean'
      );
    case 'star':
      return true;
    case 'reexport':
      return (
        typeof value.name === 'string' && typeof value.exported === 'string'
      );
    default:
      return false;
  }
}

function isArrayOf(
  value: unknown,
  isItem: (item: unknown) => boolean
): value is unknown[] {
  return Array.isArray(value) && value.every((item) => isItem(item));
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}
