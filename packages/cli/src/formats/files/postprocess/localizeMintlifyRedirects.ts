import fs from 'node:fs';
import path from 'node:path';
import { getRelative } from '../../../fs/findFilepath.js';
import type { Settings } from '../../../types/index.js';
import {
  INDEX_PAGE,
  transformUrlPath,
} from '../../../utils/localizeStaticUrls.js';
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
 * predate the run are never localized. URLs are localized with docsUrlPattern,
 * like links inside pages, and a redirect is localized for a locale only when
 * its destination has a translated page.
 */
export function localizeMintlifyRedirects(
  settings: Settings,
  signals: MintlifyRedirectSignals
): Redirect[] {
  const urlPattern = settings.options?.docsUrlPattern;
  if (
    settings.options?.mintlify?.localizeRedirects !== true ||
    !urlPattern ||
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
  const translatedPageUrls = getTranslatedPageUrls(
    settings,
    targetLocales,
    docsDir
  );
  // Localize URLs the way links inside pages are localized
  const urlPatternHead = urlPattern.split('[locale]')[0];
  const localizeUrl = (url: string, locale: string) => {
    const localized = transformUrlPath(
      url,
      urlPatternHead,
      locale,
      settings.defaultLocale,
      settings.options?.experimentalHideDefaultLocale ?? false
    );
    return localized === null ? null : normalizeUrl(localized);
  };
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
      const localizedSource = localizeUrl(sourceUrl, locale);
      const localizedDestination = localizeUrl(destinationUrl, locale);
      if (
        !localizedSource ||
        !localizedDestination ||
        !translatedPageUrls.has(localizedDestination) ||
        takenSources.has(localizedSource)
      ) {
        continue;
      }
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
 * without the extension.
 */
function pageUrl(fileName: string, docsDir: string): string {
  const relative = path.relative(docsDir, path.resolve(fileName));
  return normalizeUrl(
    relative
      .slice(0, relative.length - path.extname(relative).length)
      .split(path.sep)
      .join('/')
  );
}

/**
 * Leading slash, no trailing slash, and index pages named by their folder, so
 * equivalent spellings compare equal.
 */
function normalizeUrl(url: string): string {
  const segments = toSegments(url);
  if (segments.at(-1) === INDEX_PAGE) segments.pop();
  return `/${segments.join('/')}`;
}

function toSegments(url: string): string[] {
  return url.split('/').filter(Boolean);
}

/** URLs of the translated pages on disk, across all target locales. */
function getTranslatedPageUrls(
  settings: Settings,
  targetLocales: string[],
  docsDir: string
): Set<string> {
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

  return new Set(
    targetLocales.flatMap((locale) =>
      sourcePages
        .map((sourcePage) => fileMapping[locale]?.[sourcePage])
        .filter(
          (translatedPage): translatedPage is string =>
            translatedPage !== undefined && fs.existsSync(translatedPage)
        )
        .map((translatedPage) => pageUrl(translatedPage, docsDir))
    )
  );
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
