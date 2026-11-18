import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import type { InlineExtractionOutput } from '@generaltranslation/vue-extractor/integration';
import {
  createDiagnosticMessage,
  defaultInlineManifestPath,
} from 'generaltranslation/internal';
import { resolveLocaleFiles } from '../fs/config/parseFilesConfig.js';
import loadJSON from '../fs/loadJSON.js';
import type { Settings, Updates } from '../types/index.js';
import type { GTParsingFlags } from '../types/parsing.js';

type ManifestFlags = Pick<GTParsingFlags, 'svelteManifest'> | undefined;

/** The manifest the gt-svelte Vite plugin writes during `vite build`. */
export function svelteManifestPath(
  parsingFlags: ManifestFlags,
  projectRoot: string = process.cwd()
): string {
  return path.resolve(
    projectRoot,
    parsingFlags?.svelteManifest ?? defaultInlineManifestPath
  );
}

function missingManifestDiagnostic(file: string): string {
  return createDiagnosticMessage({
    whatHappened: `No gt-svelte manifest was found at ${file}`,
    why: 'the gt CLI does not parse gt-svelte source; its Vite plugin writes the translatable entries during vite build',
    fix: 'Run vite build before this command, or set files.gt.parsingFlags.svelteManifest to the manifest path',
  });
}

function invalidManifestDiagnostic(file: string): string {
  return createDiagnosticMessage({
    whatHappened: `The gt-svelte manifest at ${file} is not valid`,
    fix: 'Delete it and run vite build again',
  });
}

function isManifestEntry(value: unknown): value is Updates[number] {
  if (typeof value !== 'object' || value === null) return false;
  const { dataFormat, metadata } = value as {
    dataFormat?: unknown;
    metadata?: { hash?: unknown };
  };
  return (
    (dataFormat === 'JSX' || dataFormat === 'STRING') &&
    typeof metadata?.hash === 'string'
  );
}

/** Reads the manifest as the project's inline updates, in place of source parsing. */
export async function readSvelteManifest(
  parsingFlags: ManifestFlags
): Promise<InlineExtractionOutput> {
  const file = svelteManifestPath(parsingFlags);
  let content: string;
  try {
    content = await fs.promises.readFile(file, 'utf8');
  } catch {
    return {
      updates: [],
      errors: [missingManifestDiagnostic(file)],
      warnings: [],
    };
  }
  let entries: unknown;
  try {
    entries = JSON.parse(content);
  } catch {
    entries = undefined;
  }
  if (!Array.isArray(entries) || !entries.every(isManifestEntry)) {
    return {
      updates: [],
      errors: [invalidManifestDiagnostic(file)],
      warnings: [],
    };
  }
  return { updates: entries, errors: [], warnings: [] };
}

/** The hashes in the manifest, or `undefined` when it cannot be read. */
export function readSvelteManifestHashes(
  parsingFlags: ManifestFlags
): Set<string> | undefined {
  const entries = loadJSON(svelteManifestPath(parsingFlags));
  if (!Array.isArray(entries) || !entries.every(isManifestEntry)) {
    return undefined;
  }
  return new Set(entries.map((entry) => entry.metadata.hash!));
}

/**
 * The entries that at least one target locale catalog is missing.
 *
 * A value equal to its source counts as missing, because `gt generate` writes
 * the source as a placeholder for every new entry.
 */
export function selectUntranslatedUpdates(
  updates: Updates,
  settings: Pick<Settings, 'locales' | 'defaultLocale' | 'files'>
): Updates {
  const placeholderPaths = settings.files?.placeholderPaths;
  if (!placeholderPaths?.gt) return updates;
  const catalogs = settings.locales
    .filter((locale) => locale !== settings.defaultLocale)
    .map(
      (locale) =>
        loadJSON(resolveLocaleFiles(placeholderPaths, locale).gt!) ?? {}
    );
  return updates.filter((update) =>
    catalogs.some((catalog) => {
      const translation = catalog[update.metadata.hash!];
      return (
        translation === undefined ||
        isDeepStrictEqual(translation, update.source)
      );
    })
  );
}

/**
 * Adds downloaded translations to a locale's existing catalog, because the
 * download holds only the entries that were sent, and drops entries the
 * manifest no longer has.
 */
export function mergeSvelteCatalog(
  existing: string | undefined,
  downloaded: string,
  manifestHashes: ReadonlySet<string> | undefined
): string {
  let current: Record<string, unknown> = {};
  try {
    current = existing ? JSON.parse(existing) : {};
  } catch {
    current = {};
  }
  const merged = { ...current, ...JSON.parse(downloaded) };
  return JSON.stringify(
    manifestHashes
      ? Object.fromEntries(
          Object.entries(merged).filter(([hash]) => manifestHashes.has(hash))
        )
      : merged
  );
}
