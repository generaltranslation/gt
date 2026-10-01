import fs from 'node:fs';
import path from 'node:path';
import { getRelative } from '../../../fs/findFilepath.js';
import type { Settings } from '../../../types/index.js';
import { INDEX_PAGE } from '../../../utils/localizeStaticUrls.js';
import { createFileMapping } from '../fileMapping.js';

/**
 * What the upload step saw change in this run. File names are relative to the
 * working directory, the same form the CLI uploads them in.
 */
export type MintlifyRedirectSignals = {
  movedFiles: { oldFileName: string; newFileName: string }[];
  newFileNames: string[];
  orphanedFileNames: string[];
};

type Redirect = { source: string; destination: string; permanent?: unknown };

/**
 * Adds localized copies of English redirects for pages that were renamed or
 * removed in this run, and returns the redirects it added. Only redirects
 * matched by a signal from the upload step are considered, so redirects that
 * predate the run are never localized. A redirect is localized for a locale
 * only when its destination has a translated page.
 */
export function localizeMintlifyRedirects(
  settings: Settings,
  signals: MintlifyRedirectSignals
): Redirect[] {
  if (
    settings.options?.mintlify?.localizeRedirects !== true ||
    !settings.files
  ) {
    return [];
  }
  const docsJsonPath = findDocsJson(settings);
  if (!docsJsonPath) return [];
  const docsDir = path.dirname(docsJsonPath);

  // URLs of old pages (renamed or removed) and of pages new in this run
  const toUrls = (fileNames: string[]) =>
    new Set(fileNames.map((fileName) => pageUrl(fileName, docsDir)));
  const oldPageUrls = toUrls([
    ...signals.movedFiles.map((move) => move.oldFileName),
    ...signals.orphanedFileNames,
  ]);
  const newPageUrls = toUrls(signals.newFileNames);

  const location = readRedirects(docsJsonPath);
  if (!location) return [];

  const targetLocales = settings.locales.filter(
    (locale) => locale !== settings.defaultLocale
  );
  const localizedPages = getLocalizedPageUrls(settings, targetLocales, docsDir);
  const takenSources = new Set(
    location.redirects.filter(isRedirect).map((r) => normalizeUrl(r.source))
  );

  const added: Redirect[] = [];
  const updated = location.redirects.flatMap((entry) => {
    if (!isRedirect(entry)) return [entry];
    const [destinationPath, anchor] = splitAnchor(entry.destination);
    const sourceUrl = normalizeUrl(entry.source);
    const destinationUrl = normalizeUrl(destinationPath);
    if (!oldPageUrls.has(sourceUrl) && !newPageUrls.has(destinationUrl)) {
      return [entry];
    }

    const localized: Redirect[] = [];
    for (const locale of targetLocales) {
      const localizedDestination = localizedPages
        .get(locale)
        ?.get(destinationUrl);
      if (!localizedDestination) continue;
      const localizedSource = localizeSource(
        sourceUrl,
        destinationUrl,
        localizedDestination
      );
      if (!localizedSource || takenSources.has(localizedSource)) continue;
      takenSources.add(localizedSource);
      localized.push({
        source: localizedSource,
        destination: `${localizedDestination}${anchor}`,
        ...('permanent' in entry && { permanent: entry.permanent }),
      });
    }
    added.push(...localized);
    return [entry, ...localized];
  });

  if (added.length > 0) location.write(updated);
  return added;
}

/**
 * The project's docs.json: an included JSON file when the project translates
 * it, otherwise the one in the working directory, where Mintlify expects it.
 */
function findDocsJson(settings: Settings): string | null {
  const docsJsonPath =
    settings.files.resolvedPaths.json?.find(
      (filePath) => path.basename(filePath) === 'docs.json'
    ) ?? path.resolve('docs.json');
  return fs.existsSync(docsJsonPath) ? docsJsonPath : null;
}

function isRedirect(entry: unknown): entry is Redirect {
  return (
    typeof (entry as Redirect)?.source === 'string' &&
    typeof (entry as Redirect)?.destination === 'string'
  );
}

/** Splits `/docs/page#section` into `/docs/page` and `#section`. */
function splitAnchor(url: string): [string, string] {
  const anchorStart = url.indexOf('#');
  return anchorStart === -1
    ? [url, '']
    : [url.slice(0, anchorStart), url.slice(anchorStart)];
}

/**
 * The Mintlify URL of a page file: its path from the docs.json directory
 * without the extension, with index pages named by their folder.
 */
function pageUrl(fileName: string, docsDir: string): string {
  const relative = path.relative(docsDir, path.resolve(fileName));
  const segments = relative
    .slice(0, relative.length - path.extname(relative).length)
    .split(path.sep);
  if (segments[segments.length - 1] === INDEX_PAGE) segments.pop();
  return normalizeUrl(segments.join('/'));
}

/** Leading slash, no trailing slash, so equivalent spellings compare equal. */
function normalizeUrl(url: string): string {
  return `/${toSegments(url).join('/')}`;
}

function toSegments(url: string): string[] {
  return url.split('/').filter(Boolean);
}

/**
 * For each locale, the URL of every translated page on disk keyed by the URL
 * of its English page.
 */
function getLocalizedPageUrls(
  settings: Settings,
  targetLocales: string[],
  docsDir: string
): Map<string, Map<string, string>> {
  const { files } = settings;
  const fileMapping = createFileMapping(
    files.resolvedPaths,
    files.placeholderPaths,
    files.transformPaths,
    files.transformFormats,
    targetLocales,
    settings.defaultLocale
  );
  const sourcePages = [
    ...(files.resolvedPaths.md ?? []),
    ...(files.resolvedPaths.mdx ?? []),
  ].map(getRelative);

  return new Map(
    targetLocales.map((locale) => {
      const urls = new Map<string, string>();
      for (const sourcePage of sourcePages) {
        const translatedPage = fileMapping[locale]?.[sourcePage];
        if (translatedPage && fs.existsSync(translatedPage)) {
          urls.set(
            pageUrl(sourcePage, docsDir),
            pageUrl(translatedPage, docsDir)
          );
        }
      }
      return [locale, urls];
    })
  );
}

/**
 * Puts the source under the same locale segment the translated destination
 * adds, such as `/docs/fr-ca/old` for `/docs/old` when `/docs/new` translates
 * to `/docs/fr-ca/new`. Null for layouts that do not add one segment.
 */
function localizeSource(
  sourceUrl: string,
  destinationUrl: string,
  localizedDestinationUrl: string
): string | null {
  const english = toSegments(destinationUrl);
  const localized = toSegments(localizedDestinationUrl);
  let index = 0;
  while (index < english.length && english[index] === localized[index]) {
    index++;
  }
  const addsOneSegment =
    localized.length === english.length + 1 &&
    localized.slice(index + 1).join('/') === english.slice(index).join('/');
  if (!addsOneSegment) return null;

  const segments = toSegments(sourceUrl);
  segments.splice(index, 0, localized[index]);
  return `/${segments.join('/')}`;
}

/**
 * Finds the redirects array in docs.json, either inline or in the file its
 * `$ref` points to, and returns a writer for the file that holds it.
 */
function readRedirects(
  docsJsonPath: string
): { redirects: unknown[]; write: (redirects: unknown[]) => void } | null {
  const docsJson = readJson(docsJsonPath) as Record<string, unknown> | null;
  const redirects = docsJson?.redirects as { $ref?: unknown } | undefined;
  if (Array.isArray(redirects)) {
    return {
      redirects,
      write: (updated) =>
        writeJson(docsJsonPath, { ...docsJson, redirects: updated }),
    };
  }
  if (typeof redirects?.$ref === 'string') {
    const refPath = path.resolve(path.dirname(docsJsonPath), redirects.$ref);
    const referenced = readJson(refPath);
    if (Array.isArray(referenced)) {
      return {
        redirects: referenced,
        write: (updated) => writeJson(refPath, updated),
      };
    }
  }
  return null;
}

function readJson(filePath: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeJson(filePath: string, value: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
