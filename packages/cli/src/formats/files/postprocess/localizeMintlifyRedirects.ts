import fs from 'node:fs';
import path from 'node:path';
import { createDiagnosticMessage } from 'generaltranslation/diagnostics';
import { logger } from '../../../console/logger.js';
import { getRelative } from '../../../fs/findFilepath.js';
import loadJSON from '../../../fs/loadJSON.js';
import type { Settings } from '../../../types/index.js';
import {
  INDEX_PAGE,
  PAGE_EXTENSIONS,
  transformUrlPath,
  translationMissing,
} from '../../../utils/localizeStaticUrls.js';
import { createFileMapping } from '../fileMapping.js';

type Redirect = { source: string; destination: string; permanent?: unknown };

const missingDocsUrlPatternWarning = createDiagnosticMessage({
  source: 'gt',
  severity: 'Warning',
  whatHappened: 'Localized redirects were not added',
  why: 'options.mintlify.localizeRedirects uses options.docsUrlPattern to place the locale in redirect URLs',
  fix: 'Set options.docsUrlPattern in gt.config.json, such as "/docs/[locale]"',
});

/**
 * Adds localized copies of the English redirects whose source is a renamed or
 * removed page, and returns the redirects it added. Orphaned file names come
 * from the upload step, so redirects for pages GT never translated are never
 * localized. URLs are localized like links inside
 * pages: with docsUrlPattern, and not for locales missing the destination's
 * translation.
 */
export function localizeMintlifyRedirects(
  settings: Settings,
  orphanedFileNames: string[]
): Redirect[] {
  if (
    settings.options?.mintlify?.localizeRedirects !== true ||
    !settings.files
  ) {
    return [];
  }
  const urlPattern = settings.options.docsUrlPattern;
  if (!urlPattern) {
    logger.warn(missingDocsUrlPatternWarning);
    return [];
  }
  const location = readRedirects(path.resolve('docs.json'));
  if (!location) return [];

  const oldPageUrls = new Set(
    orphanedFileNames
      .filter((fileName) => PAGE_EXTENSIONS.includes(path.extname(fileName)))
      .map(pageUrl)
  );

  const targetLocales = settings.locales.filter(
    (locale) => locale !== settings.defaultLocale
  );
  const { files } = settings;
  const fileMapping = createFileMapping(
    files.resolvedPaths,
    files.placeholderPaths,
    files.transformPaths,
    files.transformFormats,
    targetLocales,
    settings.defaultLocale
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
    if (!oldPageUrls.has(sourceUrl)) return [entry];

    const localized: Redirect[] = [];
    for (const locale of targetLocales) {
      const localizedSource = localizeUrl(sourceUrl, locale);
      const localizedDestination = localizeUrl(destinationUrl, locale);
      if (
        !localizedSource ||
        !localizedDestination ||
        localizedSource === localizedDestination ||
        takenSources.has(localizedSource) ||
        translationMissing(
          destinationUrl,
          localizedDestination,
          fileMapping[locale] ?? {}
        )
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
 * The URL of a page file: its path without the extension. Like static URL
 * localization, URLs are relative to the working directory.
 */
function pageUrl(fileName: string): string {
  const relative = getRelative(fileName);
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
  const segments = url.split('/').filter(Boolean);
  if (segments.at(-1) === INDEX_PAGE) segments.pop();
  return `/${segments.join('/')}`;
}

/**
 * Finds the redirects array in docs.json, either inline or at the end of its
 * `$ref` chain, and returns a writer for the file that holds it.
 */
function readRedirects(
  docsJsonPath: string
): { redirects: unknown[]; write: (redirects: unknown[]) => void } | null {
  const docsJson = loadJSON(docsJsonPath);
  let holder = docsJsonPath;
  let value: unknown = docsJson?.redirects;
  const visited = new Set([holder]);
  while (typeof (value as { $ref?: unknown })?.$ref === 'string') {
    holder = path.resolve(
      path.dirname(holder),
      (value as { $ref: string }).$ref
    );
    if (visited.has(holder)) return null;
    visited.add(holder);
    value = loadJSON(holder);
  }
  if (!Array.isArray(value)) return null;

  const redirectsFile = holder;
  return {
    redirects: value,
    write: (updated) =>
      fs.writeFileSync(
        redirectsFile,
        JSON.stringify(
          redirectsFile === docsJsonPath
            ? { ...docsJson, redirects: updated }
            : updated,
          null,
          2
        )
      ),
  };
}
