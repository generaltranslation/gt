import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { logger } from '../../../console/logger.js';
import { getRelative } from '../../../fs/findFilepath.js';
import type { Settings } from '../../../types/index.js';
import {
  INDEX_PAGE,
  PAGE_EXTENSIONS,
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

export type MintlifyRedirectSkipReason =
  | 'wildcard'
  | 'external-destination'
  | 'destination-not-a-page'
  | 'source-is-a-page'
  | 'localized-destination-missing'
  | 'localized-source-taken'
  | 'unsupported-locale-layout';

export type MintlifyRedirectReport = {
  added: { locale: string; source: string; destination: string }[];
  skipped: {
    source: string;
    destination: string;
    locale?: string;
    reason: MintlifyRedirectSkipReason;
  }[];
};

type Redirect = { source: string; destination: string; permanent?: unknown };

type RedirectsLocation = {
  filePath: string;
  redirects: unknown[];
  write: (redirects: unknown[]) => void;
};

const EXTERNAL_URL_REGEX = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;
const WILDCARD_REGEX = /[:*]/;
const MAX_REF_DEPTH = 10;

/**
 * Adds localized copies of English redirects for pages that were renamed or
 * removed in this run. Only redirects matched by a signal from the upload step
 * are considered, so redirects that predate the run are never localized.
 */
export function localizeMintlifyRedirects(
  settings: Settings,
  signals: MintlifyRedirectSignals
): MintlifyRedirectReport {
  const report: MintlifyRedirectReport = { added: [], skipped: [] };
  if (
    settings.options?.mintlify?.localizeRedirects !== true ||
    !settings.files
  ) {
    return report;
  }

  const docsJsonPath = findDocsJson(settings);
  if (!docsJsonPath) return report;
  const docsDir = path.dirname(docsJsonPath);

  // URLs of old pages (renamed or removed) and of pages new in this run
  const toUrl = (fileName: string) => pageUrl(fileName, docsDir);
  const oldPageUrls = new Set(
    [
      ...signals.movedFiles.map((move) => move.oldFileName),
      ...signals.orphanedFileNames,
    ]
      .map(toUrl)
      .filter((url): url is string => url !== null)
  );
  const newPageUrls = new Set(
    signals.newFileNames.map(toUrl).filter((url): url is string => url !== null)
  );
  if (oldPageUrls.size === 0 && newPageUrls.size === 0) return report;

  const location = readRedirects(docsJsonPath);
  if (!location) return report;

  const targetLocales = settings.locales.filter(
    (locale) => locale !== settings.defaultLocale
  );
  const localizedPages = getLocalizedPageUrls(settings, targetLocales, docsDir);

  // Destination of every redirect, keyed by its source
  const takenSources = new Map(
    location.redirects
      .filter(isRedirect)
      .map((redirect) => [
        normalizeUrl(redirect.source),
        normalizeUrl(redirect.destination),
      ])
  );
  const handledSources = new Set<string>();
  const insertions = new Map<number, Redirect[]>();

  location.redirects.forEach((entry, index) => {
    if (!isRedirect(entry)) return;
    const { source, destination } = entry;
    const [destinationPath, ...anchorParts] = destination.split('#');
    const anchor = anchorParts.length ? `#${anchorParts.join('#')}` : '';
    const sourceUrl = normalizeUrl(source);
    const destinationUrl = normalizeUrl(destinationPath);

    if (!oldPageUrls.has(sourceUrl) && !newPageUrls.has(destinationUrl)) {
      return;
    }
    if (handledSources.has(sourceUrl)) return;
    handledSources.add(sourceUrl);

    const skip = (reason: MintlifyRedirectSkipReason, locale?: string) =>
      report.skipped.push({
        source,
        destination,
        ...(locale && { locale }),
        reason,
      });

    if (EXTERNAL_URL_REGEX.test(destinationPath)) {
      return skip('external-destination');
    }
    if (WILDCARD_REGEX.test(source) || WILDCARD_REGEX.test(destinationPath)) {
      return skip('wildcard');
    }
    if (pageExistsAtUrl(sourceUrl, docsDir)) return skip('source-is-a-page');
    if (!pageExistsAtUrl(destinationUrl, docsDir)) {
      return skip('destination-not-a-page');
    }

    const localized: Redirect[] = [];
    for (const locale of targetLocales) {
      const localizedDestinationUrl = localizedPages
        .get(locale)
        ?.get(destinationUrl);
      if (!localizedDestinationUrl) {
        skip('localized-destination-missing', locale);
        continue;
      }

      // The translated destination shows where the locale segment goes
      const insertion = findInsertedSegment(
        destinationUrl,
        localizedDestinationUrl
      );
      const sourceSegments = toSegments(sourceUrl);
      if (!insertion || insertion.index > sourceSegments.length) {
        skip('unsupported-locale-layout', locale);
        continue;
      }

      const localizedSource = insertSegment(source, insertion);
      const localizedDestination = `${insertSegment(destinationPath, insertion)}${anchor}`;
      const takenDestination = takenSources.get(normalizeUrl(localizedSource));
      if (takenDestination !== undefined) {
        // A matching redirect is the expected state on later runs, since
        // removed pages stay orphaned; only a conflicting one is reported
        if (takenDestination !== normalizeUrl(localizedDestination)) {
          skip('localized-source-taken', locale);
        }
        continue;
      }
      takenSources.set(
        normalizeUrl(localizedSource),
        normalizeUrl(localizedDestination)
      );

      localized.push({
        source: localizedSource,
        destination: localizedDestination,
        ...('permanent' in entry && { permanent: entry.permanent }),
      });
      report.added.push({
        locale,
        source: localizedSource,
        destination: localizedDestination,
      });
    }
    if (localized.length) insertions.set(index, localized);
  });

  if (insertions.size > 0) {
    location.write(
      location.redirects.flatMap((entry, index) => [
        entry,
        ...(insertions.get(index) ?? []),
      ])
    );
  }
  return report;
}

const SKIP_REASON_MESSAGES: Record<MintlifyRedirectSkipReason, string> = {
  wildcard: 'wildcard redirects are not localized',
  'external-destination': 'the destination is an external URL',
  'destination-not-a-page': 'the destination is not a page',
  'source-is-a-page': 'the source page still exists',
  'localized-destination-missing': 'the translated destination page is missing',
  'localized-source-taken':
    'a redirect for the translated source already points elsewhere',
  'unsupported-locale-layout':
    'translated pages do not use a locale path segment',
};

export function logMintlifyRedirectReport(
  report: MintlifyRedirectReport
): void {
  if (report.added.length > 0) {
    const locales = [...new Set(report.added.map(({ locale }) => locale))];
    logger.success(
      `Added ${report.added.length} localized redirect${report.added.length === 1 ? '' : 's'} (${locales.join(', ')})`
    );
  }
  for (const { source, destination, locale, reason } of report.skipped) {
    logger.info(
      chalk.dim(
        `Skipped localizing redirect ${source} → ${destination}${locale ? ` (${locale})` : ''}: ${SKIP_REASON_MESSAGES[reason]}`
      )
    );
  }
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
    typeof entry === 'object' &&
    entry !== null &&
    typeof (entry as Redirect).source === 'string' &&
    typeof (entry as Redirect).destination === 'string'
  );
}

/**
 * The Mintlify URL of a page file: its path from the docs.json directory
 * without the extension, with index pages named by their folder. Null for
 * files that are not pages or live outside the docs directory.
 */
function pageUrl(fileName: string, docsDir: string): string | null {
  const extension = path.extname(fileName);
  if (!PAGE_EXTENSIONS.includes(extension)) return null;
  const relative = path.relative(docsDir, path.resolve(fileName));
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  const segments = relative.slice(0, -extension.length).split(path.sep);
  if (segments[segments.length - 1] === INDEX_PAGE) segments.pop();
  return `/${segments.join('/')}`;
}

/** Leading slash, no trailing slash, so equivalent spellings compare equal. */
function normalizeUrl(url: string): string {
  return `/${toSegments(url).join('/')}`;
}

function toSegments(url: string): string[] {
  return url.split('/').filter(Boolean);
}

function pageExistsAtUrl(url: string, docsDir: string): boolean {
  const base = path.join(docsDir, ...toSegments(url));
  return PAGE_EXTENSIONS.some(
    (extension) =>
      fs.existsSync(`${base}${extension}`) ||
      fs.existsSync(path.join(base, `${INDEX_PAGE}${extension}`))
  );
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

  const localizedPages = new Map<string, Map<string, string>>();
  for (const locale of targetLocales) {
    const urls = new Map<string, string>();
    for (const sourcePage of sourcePages) {
      const translatedPage = fileMapping[locale]?.[sourcePage];
      if (!translatedPage || !fs.existsSync(translatedPage)) continue;
      const sourceUrl = pageUrl(sourcePage, docsDir);
      const translatedUrl = pageUrl(translatedPage, docsDir);
      if (sourceUrl && translatedUrl) urls.set(sourceUrl, translatedUrl);
    }
    localizedPages.set(locale, urls);
  }
  return localizedPages;
}

/**
 * The single path segment a translated URL adds to its English URL, such as
 * `fr-ca` in `/docs/fr-ca/page` for `/docs/page`.
 */
function findInsertedSegment(
  englishUrl: string,
  localizedUrl: string
): { index: number; segment: string } | null {
  const english = toSegments(englishUrl);
  const localized = toSegments(localizedUrl);
  if (localized.length !== english.length + 1) return null;
  for (let index = 0; index < localized.length; index++) {
    const withoutSegment = [
      ...localized.slice(0, index),
      ...localized.slice(index + 1),
    ];
    if (withoutSegment.every((segment, i) => segment === english[i])) {
      return { index, segment: localized[index] };
    }
  }
  return null;
}

/** Inserts the locale segment, keeping the URL's leading and trailing slashes. */
function insertSegment(
  url: string,
  { index, segment }: { index: number; segment: string }
): string {
  const leading = url.match(/^\/*/)?.[0] ?? '';
  const trailing = url.length > leading.length ? url.match(/\/*$/)?.[0] : '';
  const segments = toSegments(url);
  segments.splice(index, 0, segment);
  return `${leading}${segments.join('/')}${trailing ?? ''}`;
}

/**
 * Finds the redirects array in docs.json, following `$ref` files the way
 * Mintlify resolves them, and returns a writer for the file that holds it.
 */
function readRedirects(docsJsonPath: string): RedirectsLocation | null {
  const docsJson = readJson(docsJsonPath);
  if (!isObject(docsJson) || !('redirects' in docsJson)) return null;

  let filePath = docsJsonPath;
  let value: unknown = docsJson.redirects;
  for (let depth = 0; depth < MAX_REF_DEPTH; depth++) {
    if (Array.isArray(value)) {
      const redirects = value;
      const holder = filePath;
      return {
        filePath: holder,
        redirects,
        write: (updated) => {
          if (holder === docsJsonPath) {
            writeJson(holder, { ...docsJson, redirects: updated });
          } else {
            writeJson(holder, updated);
          }
        },
      };
    }
    if (!isObject(value) || typeof value.$ref !== 'string') return null;
    filePath = path.resolve(path.dirname(filePath), value.$ref);
    value = readJson(filePath);
  }
  return null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readJson(filePath: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeJson(filePath: string, value: unknown): void {
  const trailingNewline = fs.readFileSync(filePath, 'utf8').endsWith('\n')
    ? '\n'
    : '';
  fs.writeFileSync(
    filePath,
    `${JSON.stringify(value, null, 2)}${trailingNewline}`
  );
}
