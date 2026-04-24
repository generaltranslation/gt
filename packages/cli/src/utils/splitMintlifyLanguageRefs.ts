import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../console/logger.js';
import { Settings } from '../types/index.js';
import type { RefMap } from './resolveMintlifyRefs.js';
import { shouldResolveRefs } from './resolveMintlifyRefs.js';
import { getStoredRefMap } from '../state/mintlifyRefMap.js';

/**
 * Post-processing step for Mintlify docs.json.
 *
 * After mergeJson writes a fully-inlined docs.json, this function restores
 * the original $ref structure:
 *
 * - Default locale: restores original $ref paths
 * - Non-default locales: prefixes ref paths with {locale}/, writes translated
 *   content to the prefixed paths
 * - Top-level refs (navigation, navbar): restored in docs.json
 */
export async function splitMintlifyLanguageRefs(
  settings: Settings
): Promise<void> {
  const isMintlify =
    settings.framework === 'mintlify' || !!settings.options?.mintlify;
  if (!isMintlify) return;

  const refMap = getStoredRefMap();
  if (!refMap || refMap.size === 0) return;

  const resolvedJsonPaths = settings.files?.resolvedPaths?.json;
  if (!resolvedJsonPaths) return;

  // Find the JSON file that has $ref resolution configured (composite schema + mintlify)
  const docsJsonPath = resolvedJsonPaths.find((p) =>
    shouldResolveRefs(p, settings.options)
  );
  if (!docsJsonPath) return;
  if (!fs.existsSync(docsJsonPath)) return;

  let docsJson: any;
  try {
    docsJson = JSON.parse(fs.readFileSync(docsJsonPath, 'utf-8'));
  } catch {
    return;
  }

  const defaultLocale = settings.defaultLocale;

  // Find where the languages array lives
  const navRefEntry = refMap.get('/navigation');
  const navContent = navRefEntry
    ? getAtPointer(docsJson, '/navigation')
    : docsJson?.navigation;

  const languages: any[] | undefined = navContent?.languages;
  if (!Array.isArray(languages) || languages.length <= 1) {
    // No language splitting needed, but still restore top-level refs
    restoreTopLevelRefs(docsJson, refMap, docsJsonPath);
    return;
  }

  // Find the default locale entry
  const defaultIndex = languages.findIndex(
    (e: any) => e?.language === defaultLocale
  );
  if (defaultIndex < 0) return;

  const navDir = navRefEntry
    ? path.dirname(navRefEntry.sourceFile)
    : path.dirname(docsJsonPath);

  // Collect the default locale entry's internal $ref entries
  const defaultPointerPrefix = `/navigation/languages/${defaultIndex}`;
  const internalRefs = collectInternalRefs(refMap, defaultPointerPrefix, navDir);

  if (internalRefs.length > 0) {
    // Restore default locale's refs (same paths as original)

    // Restore default locale's refs (same paths as original)
    const defaultEntry = languages[defaultIndex];
    for (const ref of internalRefs) {
      setAtPointer(defaultEntry, ref.relativePointer, { $ref: ref.refPath });
    }

    // For each non-default locale: write translated content to locale-prefixed
    // paths and insert $ref pointers. Deepest refs are processed first so their
    // content is extracted before the parent replaces them.
    //
    // Only the shallowest refs (direct children of the language entry) get a
    // locale-prefixed $ref path. Deeper nested refs keep their original relative
    // paths because the parent file is already in the locale directory, so
    // relative resolution works naturally.
    for (const entry of languages) {
      if (!entry || entry.language === defaultLocale) continue;
      const locale = entry.language;
      if (!locale) continue;

      // Determine which refs are "top-level" (direct children of the entry)
      // vs nested (refs within other refs). A ref is top-level if no other
      // ref's pointer is a prefix of its pointer.
      const topLevelPointers = new Set(
        internalRefs
          .filter(
            (ref) =>
              !internalRefs.some(
                (other) =>
                  other !== ref &&
                  ref.relativePointer.startsWith(
                    other.relativePointer + '/'
                  )
              )
          )
          .map((r) => r.relativePointer)
      );

      for (const ref of internalRefs) {
        const subtree = getAtPointer(entry, ref.relativePointer);
        if (subtree === undefined) continue;

        // Resolve the original ref path from its containing directory,
        // then compute the locale-prefixed output path
        const originalAbsPath = path.resolve(ref.resolvedDir, ref.refPath);
        const relToNavDir = path.relative(navDir, originalAbsPath);
        const localeRelPath = path.join(locale, relToNavDir);
        const outputPath = path.resolve(navDir, localeRelPath);
        writeJsonFile(outputPath, subtree);

        // Top-level refs get prefixed $ref; nested refs keep original path
        // (because the parent file is already in the locale dir)
        if (topLevelPointers.has(ref.relativePointer)) {
          const prefixedRefPath = prefixRefWithLocale(ref.refPath, locale);
          setAtPointer(entry, ref.relativePointer, { $ref: prefixedRefPath });
        } else {
          setAtPointer(entry, ref.relativePointer, { $ref: ref.refPath });
        }
      }
    }

    logger.info(
      `Restored $ref structure for source locale navigation`
    );
  }

  // Wrap each non-default locale entry into its own ref file.
  // If internal refs were processed above, the entry already has $ref pointers
  // so the file is compact. Mintlify's merge rule merges `language` on top.
  //
  // The file name is derived from the actual navigation file (if it's a $ref)
  // or uses a generic name if navigation is inline in docs.json.
  const navFileName = navRefEntry
    ? path.basename(navRefEntry.sourceFile)
    : 'navigation.json';

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

  logger.info(
    `Split locale navigation entries into ref files`
  );

  // Now restore top-level refs (navigation → file, navbar → file, etc.)
  // This must happen AFTER language processing so the nav file gets the
  // updated language entries with $ref.
  restoreTopLevelRefs(docsJson, refMap, docsJsonPath);
}

/**
 * Restore top-level $ref pointers in docs.json.
 * Writes each resolved subtree to its original source file and replaces
 * the subtree in docs.json with the $ref pointer.
 */
function restoreTopLevelRefs(
  docsJson: any,
  refMap: RefMap,
  docsJsonPath: string
): void {
  let changed = false;

  for (const [pointer, entry] of refMap.entries()) {
    // Only handle refs directly in docs.json, not inside language entries
    if (pointer.match(/^\/navigation\/languages\/\d+/)) continue;

    const subtree = getAtPointer(docsJson, pointer);
    if (subtree === undefined) continue;

    writeJsonFile(entry.sourceFile, subtree);
    setAtPointer(docsJson, pointer, { $ref: entry.refPath });
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(
      docsJsonPath,
      JSON.stringify(docsJson, null, 2),
      'utf-8'
    );
  }
}

/**
 * Collect refMap entries that describe a language entry's internal $ref chain.
 * Sorted deepest-first so nested content is extracted before parents.
 */
function collectInternalRefs(
  refMap: RefMap,
  entryPointerPrefix: string,
  navDir: string
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
      // The directory from which this $ref path should be resolved
      resolvedDir: entry.containingDir,
    });
  }

  refs.sort((a, b) => b.relativePointer.length - a.relativePointer.length);
  return refs;
}

/**
 * Prefix a $ref path with a locale directory.
 * "./tabs/guides.json" → "./es/tabs/guides.json"
 * "../groups/api.json" → "../es/groups/api.json"
 */
function prefixRefWithLocale(refPath: string, locale: string): string {
  if (refPath.startsWith('./')) {
    return `./${locale}/${refPath.slice(2)}`;
  }
  if (refPath.startsWith('../')) {
    return `../${locale}/${refPath.slice(3)}`;
  }
  return `./${locale}/${refPath}`;
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
