import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import type { ParsedSummary } from '../analysis/module-index.js';

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
 * What every entry depends on besides its file: this package's version and
 * format, and the versions of the languages' tooling in the project. An entry
 * written with another fingerprint is not used.
 */
export function cacheFingerprint(
  projectRoot: string,
  inputs: {
    packageVersion: string;
    /** The packages the languages' tooling is loaded from. */
    tools: readonly string[];
    /** Anything else entries depend on, e.g. the auto-imported names. */
    settings: readonly string[];
  }
): string {
  const require = createRequire(path.join(projectRoot, 'package.json'));
  const toolVersions = [...new Set(inputs.tools)].sort().map((name) => {
    try {
      const manifest = require(`${name}/package.json`) as { version?: string };
      return `${name}@${manifest.version ?? '?'}`;
    } catch {
      return `${name}@none`;
    }
  });

  return contentHash(
    JSON.stringify([
      FORMAT,
      inputs.packageVersion,
      toolVersions,
      inputs.settings,
    ])
  );
}

/** This package's version, from its manifest above this module, in `src` or in `dist`. */
export function packageVersion(): string {
  let directory = path.dirname(fileURLToPath(import.meta.url));

  for (;;) {
    try {
      const manifest = JSON.parse(
        fs.readFileSync(path.join(directory, 'package.json'), 'utf8')
      ) as { name?: string; version?: string };
      if (manifest.name === '@generaltranslation/paraglide-js')
        return manifest.version ?? '?';
    } catch {
      // Not here: go up.
    }

    const parent = path.dirname(directory);
    if (parent === directory) return '?';
    directory = parent;
  }
}

export class UsageCache {
  private readonly cached = new Map<string, CachedFile>();
  private readonly found = new Map<string, CachedFile>();

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
        if (entry) cache.cached.set(file, entry);
      }
    }

    return cache;
  }

  /** What the last run found of `file`, absolute. */
  get(file: string): CachedFile | undefined {
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
  save(maxLockBytes = MAX_LOCK_BYTES): void {
    const files = Object.fromEntries(
      [...this.found]
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([file, entry]) => [file, encodeEntry(entry)])
    );
    const section: Section = {
      version: FORMAT,
      fingerprint: this.fingerprint,
      files,
    };
    const size = JSON.stringify(section).length;
    const lockFile = path.join(this.projectRoot, LOCK_FILE);
    const fallbackFile = path.join(this.projectRoot, FALLBACK_FILE);

    try {
      const isLocked = fs.existsSync(lockFile) && size <= maxLockBytes;

      updateJson(lockFile, isLocked ? section : undefined);
      if (isLocked) {
        fs.rmSync(fallbackFile, { force: true });
      } else {
        fs.mkdirSync(path.dirname(fallbackFile), { recursive: true });
        fs.writeFileSync(
          fallbackFile,
          `${JSON.stringify({ [SECTION]: section })}\n`
        );
      }
    } catch {
      // The next run starts cold.
    }
  }

  private relative(file: string): string {
    return path.relative(this.projectRoot, file).split(path.sep).join('/');
  }
}

function readSection(file: string): Section | undefined {
  try {
    const json = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<
      string,
      unknown
    >;
    const section = json[SECTION] as Section | undefined;

    return section && typeof section.files === 'object' ? section : undefined;
  } catch {
    return undefined;
  }
}

/** Sets the section of the lock file, or removes it, as the CLI writes it: two spaces, a final newline. */
function updateJson(file: string, section: Section | undefined): void {
  if (!fs.existsSync(file)) return;

  const original = fs.readFileSync(file, 'utf8');
  const json = JSON.parse(original) as Record<string, unknown>;
  if (section === undefined && !(SECTION in json)) return;

  if (section) json[SECTION] = section;
  else delete json[SECTION];

  const finalNewline = original.endsWith('\n') ? '\n' : '';
  fs.writeFileSync(file, `${JSON.stringify(json, null, 2)}${finalNewline}`);
}

/**
 * One line, whatever indentation writes the lock file: a diff shows one line
 * per file that changed. Compressed, as the entries are long and repetitive.
 */
function encodeEntry(entry: CachedFile): string {
  const json = JSON.stringify(entry, (_, value: unknown) =>
    value instanceof Int32Array ? { sites: Array.from(value) } : value
  );

  return zlib.deflateRawSync(json).toString('base64');
}

function decodeEntry(encoded: string): CachedFile | undefined {
  try {
    const json = zlib.inflateRawSync(Buffer.from(encoded, 'base64')).toString();

    return JSON.parse(json, (_, value: unknown) => {
      const isSites =
        typeof value === 'object' &&
        value !== null &&
        Array.isArray((value as { sites?: unknown }).sites) &&
        Object.keys(value).length === 1;

      return isSites
        ? Int32Array.from((value as { sites: number[] }).sites)
        : value;
    }) as CachedFile;
  } catch {
    return undefined;
  }
}
