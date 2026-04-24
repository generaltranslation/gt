import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../console/logger.js';
import { Settings } from '../types/index.js';
import type { RefMap } from './resolveMintlifyRefs.js';
import { shouldResolveRefs } from './resolveMintlifyRefs.js';
import micromatch from 'micromatch';
import { getStoredRefMap, clearStoredRefMap } from '../state/mintlifyRefMap.js';

/**
 * Post-processing step for Mintlify docs.json.
 *
 * After mergeJson writes a fully-inlined docs.json, this function:
 * 1. Restores the original $ref structure (if the source used $ref)
 * 2. Wraps each non-default locale entry into its own ref file
 *    to keep the navigation file small
 */
export async function splitMintlifyLanguageRefs(
  settings: Settings
): Promise<void> {
  const isMintlify =
    settings.framework === 'mintlify' || !!settings.options?.mintlify;
  if (!isMintlify) return;

  const refMap = getStoredRefMap();

  try {
    const resolvedJsonPaths = settings.files?.resolvedPaths?.json;
    if (!resolvedJsonPaths) return;

    // Find the composite JSON file — either via shouldResolveRefs (if refMap exists)
    // or by checking for a composite jsonSchema entry directly
    const docsJsonPath =
      resolvedJsonPaths.find((p) => shouldResolveRefs(p, settings.options)) ??
      findCompositeJsonFile(resolvedJsonPaths, settings.options);
    if (!docsJsonPath) return;
    if (!fs.existsSync(docsJsonPath)) return;

    let docsJson: any;
    try {
      docsJson = JSON.parse(fs.readFileSync(docsJsonPath, 'utf-8'));
    } catch {
      return;
    }

    const defaultLocale = settings.defaultLocale;
    const docsDir = path.dirname(docsJsonPath);

    // Determine where navigation lives
    const navRefEntry = refMap?.get('/navigation');
    const navContent = navRefEntry
      ? getAtPointer(docsJson, '/navigation')
      : docsJson?.navigation;

    const languages: any[] | undefined = navContent?.languages;
    if (!Array.isArray(languages) || languages.length <= 1) {
      if (refMap && refMap.size > 0) {
        restoreTopLevelRefs(docsJson, refMap, docsJsonPath);
      }
      return;
    }

    const defaultIndex = languages.findIndex(
      (e: any) => e?.language === defaultLocale
    );
    if (defaultIndex < 0) {
      if (refMap && refMap.size > 0) {
        restoreTopLevelRefs(docsJson, refMap, docsJsonPath);
      }
      return;
    }

    const navDir = navRefEntry ? path.dirname(navRefEntry.sourceFile) : docsDir;

    // Restore $ref structure if the source used $ref
    if (refMap && refMap.size > 0) {
      const defaultPointerPrefix = `/navigation/languages/${defaultIndex}`;
      const internalRefs = collectInternalRefs(refMap, defaultPointerPrefix);

      if (internalRefs.length > 0) {
        // Restore default locale's refs
        const defaultEntry = languages[defaultIndex];
        for (const ref of internalRefs) {
          setAtPointer(defaultEntry, ref.relativePointer, {
            $ref: ref.refPath,
          });
        }

        // Write locale ref files mirroring the source topology
        for (const entry of languages) {
          if (!entry || entry.language === defaultLocale) continue;
          const locale = entry.language;
          if (!locale) continue;

          for (const ref of internalRefs) {
            const subtree = getAtPointer(entry, ref.relativePointer);
            if (subtree === undefined) continue;

            const originalAbsPath = path.resolve(ref.resolvedDir, ref.refPath);
            const relToNavDir = path.relative(navDir, originalAbsPath);
            const localeRelPath = path.join(locale, relToNavDir);
            const outputPath = path.resolve(navDir, localeRelPath);
            writeJsonFile(outputPath, subtree);

            setAtPointer(entry, ref.relativePointer, { $ref: ref.refPath });
          }
        }

        logger.info(`Restored $ref structure for source locale navigation`);
      }
    }

    // Wrap each non-default locale entry into its own ref file.
    // This runs regardless of whether the source used $ref — it keeps
    // the navigation file small by extracting locale content.
    const navFileName = navRefEntry
      ? path.basename(navRefEntry.sourceFile)
      : path.basename(docsJsonPath);

    for (let i = 0; i < languages.length; i++) {
      const entry = languages[i];
      if (!entry || entry.language === defaultLocale) continue;
      const locale = entry.language;
      if (!locale) continue;

      const { language, ...contentWithoutLanguage } = entry;
      const entryFileName = `${locale}/${navFileName}`;
      const entryFilePath = path.resolve(navDir, entryFileName);
      writeJsonFile(entryFilePath, contentWithoutLanguage);

      languages[i] = { language: locale, $ref: `./${entryFileName}` };
    }

    logger.info(`Split locale navigation entries into ref files`);

    // Restore top-level refs and write the final docs.json
    if (refMap && refMap.size > 0) {
      restoreTopLevelRefs(docsJson, refMap, docsJsonPath);
    } else {
      // No refMap — navigation is inline in docs.json, write it back directly
      fs.writeFileSync(
        docsJsonPath,
        JSON.stringify(docsJson, null, 2),
        'utf-8'
      );
    }
  } finally {
    clearStoredRefMap();
  }
}

/**
 * Find the composite JSON file from the jsonSchema config.
 * Used when no refMap exists (no $ref in source).
 */
function findCompositeJsonFile(
  resolvedPaths: string[],
  options?: Record<string, any>
): string | undefined {
  if (!options?.jsonSchema) return undefined;

  for (const filePath of resolvedPaths) {
    const relative = path.relative(process.cwd(), filePath);
    for (const [glob, schema] of Object.entries(
      options.jsonSchema as Record<string, any>
    )) {
      if (schema?.composite && micromatch.isMatch(relative, glob)) {
        return filePath;
      }
    }
  }
  return undefined;
}

/**
 * Restore top-level $ref pointers in docs.json.
 * Sorted deepest-first so nested refs are written before parents.
 */
function restoreTopLevelRefs(
  docsJson: any,
  refMap: RefMap,
  docsJsonPath: string
): void {
  let changed = false;

  const entries = [...refMap.entries()]
    .filter(([pointer]) => !pointer.match(/^\/navigation\/languages\/\d+/))
    .sort(([a], [b]) => b.length - a.length);

  for (const [pointer, entry] of entries) {
    const subtree = getAtPointer(docsJson, pointer);
    if (subtree === undefined) continue;

    writeJsonFile(entry.sourceFile, subtree);
    setAtPointer(docsJson, pointer, { $ref: entry.refPath });
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(docsJsonPath, JSON.stringify(docsJson, null, 2), 'utf-8');
  }
}

/**
 * Collect refMap entries that describe a language entry's internal $ref chain.
 * Sorted deepest-first so nested content is extracted before parents.
 */
function collectInternalRefs(
  refMap: RefMap,
  entryPointerPrefix: string
): { relativePointer: string; refPath: string; resolvedDir: string }[] {
  const refs: {
    relativePointer: string;
    refPath: string;
    resolvedDir: string;
  }[] = [];

  for (const [pointer, entry] of refMap.entries()) {
    if (!pointer.startsWith(entryPointerPrefix + '/')) continue;
    refs.push({
      relativePointer: pointer.slice(entryPointerPrefix.length),
      refPath: entry.refPath,
      resolvedDir: entry.containingDir,
    });
  }

  refs.sort((a, b) => b.relativePointer.length - a.relativePointer.length);
  return refs;
}

function writeJsonFile(filePath: string, data: unknown): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function getAtPointer(obj: any, pointer: string): any {
  if (!pointer || pointer === '/') return obj;
  const parts = pointer.split('/').filter(Boolean);
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    const index = /^\d+$/.test(part) ? parseInt(part) : part;
    current = current[index];
  }
  return current;
}

function setAtPointer(obj: any, pointer: string, value: any): void {
  if (!pointer || pointer === '/') return;
  const parts = pointer.split('/').filter(Boolean);
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const index = /^\d+$/.test(parts[i]) ? parseInt(parts[i]) : parts[i];
    if (current[index] === undefined) return;
    current = current[index];
  }
  const lastPart = parts[parts.length - 1];
  const lastIndex = /^\d+$/.test(lastPart) ? parseInt(lastPart) : lastPart;
  current[lastIndex] = value;
}
