import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { GTOutputFileConfig } from 'generaltranslation/types';
import { nodeRequire } from './nodeCompat';
import { createInlineTranslationsShardsWarning } from '../errors/createErrors';

type CompilerFileHelpers = Pick<
  typeof import('@generaltranslation/compiler'),
  'readTranslationsFile' | 'resolveInlineTranslationsFiles'
>;

const SHARD_FORMAT_VERSION = '1';
const SHARDS_DIR = path.join('cache', 'gt', 'inline');
const TEMP_PREFIX = '.tmp-';
const STALE_TEMP_MS = 60 * 60 * 1000;
const FALLBACK_SHARD_KEY = '_';
// Every key is written for every locale, so the plugin can treat a missing shard as an error
const SHARD_KEYS = [
  ...Array.from({ length: 256 }, (_, byte) =>
    byte.toString(16).padStart(2, '0')
  ),
  FALLBACK_SHARD_KEY,
];

/**
 * Plugin options pointing the SWC plugin at the shard files holding the
 * translations to embed. `dir` is relative to the working directory, which
 * the plugin reads through the WASI `/cwd` mount.
 */
export type ResolvedInlineTranslations = {
  locales: string[];
  dir: string;
  contentHash: string;
};

/**
 * Shard key for a translation hash: its first two lowercase hex characters,
 * or `_` otherwise. Must match the SWC plugin's `shard_key`.
 */
export function getShardKey(hash: string): string {
  return /^[0-9a-f]{2}/.test(hash) ? hash.slice(0, 2) : FALLBACK_SHARD_KEY;
}

/**
 * Write the translations to embed for `files.gt.inlineTranslations.locales`
 * as shard files under `<distDir>/cache/gt/inline/<contentHash>` and return
 * the plugin options. Locales without a translations file are dropped.
 * Returns undefined outside production builds, matching the babel compiler.
 */
export function resolveInlineTranslations(
  gtFiles:
    | Pick<GTOutputFileConfig, 'output' | 'inlineTranslations'>
    | undefined,
  { distDir = '.next' }: { distDir?: string } = {}
): ResolvedInlineTranslations | undefined {
  if (process.env.NODE_ENV !== 'production') return undefined;
  if (!gtFiles?.inlineTranslations?.locales.length) return undefined;

  const compiler = nodeRequire(
    '@generaltranslation/compiler'
  ) as CompilerFileHelpers;
  const files = compiler.resolveInlineTranslationsFiles(gtFiles);
  if (files.length === 0) return undefined;

  const cwd = process.cwd();
  const shardsRoot = path.resolve(cwd, distDir, SHARDS_DIR);
  const contentHash = hashContent(files);
  const target = path.join(shardsRoot, contentHash);
  const dir = path.relative(cwd, target);
  // The plugin can only read inside the working directory
  if (dir.startsWith('..') || path.isAbsolute(dir)) {
    throw new Error(
      `gt-next: cannot embed translations because distDir (${distDir}) is outside the working directory (${cwd}).`
    );
  }

  // next start also loads the config, possibly on a read-only filesystem, and
  // needs no shards; a build fails in the SWC plugin when they are missing
  try {
    if (!fs.existsSync(target)) {
      writeShards(shardsRoot, target, files, compiler.readTranslationsFile);
    }
    removeStaleShards(shardsRoot, contentHash);
  } catch (error) {
    console.warn(createInlineTranslationsShardsWarning(dir, error));
  }

  return {
    locales: files.map(({ locale }) => locale),
    dir: dir.split(path.sep).join('/'),
    contentHash,
  };
}

function hashContent(files: { locale: string; filePath: string }[]): string {
  const hash = crypto.createHash('sha256').update(SHARD_FORMAT_VERSION);
  for (const { locale, filePath } of files) {
    const file = fs.readFileSync(filePath);
    hash.update(`\0${locale}\0${file.length}\0`).update(file);
  }
  return hash.digest('hex').slice(0, 16);
}

/**
 * Builds the shards in a private temp directory and renames it into place, so
 * a complete `target` is the only state other build workers can observe.
 */
function writeShards(
  shardsRoot: string,
  target: string,
  files: { locale: string; filePath: string }[],
  readTranslationsFile: CompilerFileHelpers['readTranslationsFile']
): void {
  fs.mkdirSync(shardsRoot, { recursive: true });
  const temp = fs.mkdtempSync(path.join(shardsRoot, TEMP_PREFIX));
  try {
    for (const { locale, filePath } of files) {
      const localeDir = path.join(temp, locale);
      fs.mkdirSync(localeDir);
      const shards = groupByShard(readTranslationsFile(filePath) ?? {});
      for (const key of SHARD_KEYS) {
        fs.writeFileSync(
          path.join(localeDir, `${key}.json`),
          JSON.stringify(shards[key] ?? {})
        );
      }
    }
    try {
      fs.renameSync(temp, target);
    } catch (error) {
      if (!fs.existsSync(target)) throw error;
    }
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

function groupByShard(
  translations: Record<string, unknown>
): Record<string, Record<string, unknown>> {
  // Prototype-less, so a hash such as `__proto__` is stored like any other
  const shards: Record<string, Record<string, unknown>> = Object.create(null);
  for (const [hash, value] of Object.entries(translations)) {
    (shards[getShardKey(hash)] ??= Object.create(null))[hash] = value;
  }
  return shards;
}

/**
 * Removes shard directories for other translation content, and temp
 * directories old enough that their writer must have died.
 */
function removeStaleShards(shardsRoot: string, contentHash: string): void {
  for (const entry of fs.readdirSync(shardsRoot)) {
    if (entry === contentHash) continue;
    const full = path.join(shardsRoot, entry);
    if (entry.startsWith(TEMP_PREFIX)) {
      const stat = fs.statSync(full, { throwIfNoEntry: false });
      if (!stat || Date.now() - stat.mtimeMs < STALE_TEMP_MS) continue;
    }
    fs.rmSync(full, { recursive: true, force: true });
  }
}
