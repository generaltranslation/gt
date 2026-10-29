/**
 * Locale twins acceptance (spec §9) against a production build served the
 * way users host it. Expected strings come from the app's translation files
 * and the build output, never from this file, so the checks apply to any
 * locale twin SPA registered in apps.mjs with a `twins` field.
 */
import type { Browser, Page } from '@playwright/test';
import { getApp } from '../apps.mjs';
import {
  checkIsolation,
  segmentAlternatives,
  textSegments,
  UNFILLED_PLACEHOLDER_PATTERN,
} from '../locale-twins/twinOutput';
import { expect, test } from './fixtures';
import {
  fileOfUrl,
  newLocaleContext,
  readTwinBuild,
  ResponseCapture,
  tableHashes,
  trackCacheHits,
  twinsOf,
  unexpectedScripts,
  writeTwinReport,
  type CapturedResponse,
  type ContextOptions,
  type TwinAppConfig,
  type TwinBuild,
} from './twins-helpers';

const appName = process.env.GT_TEST_APP;
const app = getApp(appName);
const twins: TwinAppConfig | undefined =
  'twins' in app ? (app.twins as TwinAppConfig) : undefined;
const localeSelectorName = 'General Translation locale selector';

test.skip(!twins, `${appName} does not use locale twins`);
test.describe.configure({ mode: 'serial' });

let build: TwinBuild;

test.beforeAll(() => {
  build = readTwinBuild(twins!);
});

/** The visible locale marker the twin test apps render. */
function localeMarker(page: Page, locale: string) {
  return page.getByText(`Locale: ${locale}`, { exact: true });
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('requestfailed', (request) => {
    if (request.failure()?.errorText === 'net::ERR_ABORTED') return;
    errors.push(`requestfailed: ${request.url()}`);
  });
  return errors;
}

/** Segments of `hashes` that the page does not show in `locale`. */
function missingRenderedText(
  text: string,
  locale: string,
  hashes: Iterable<string>
): string[] {
  const missing: string[] = [];
  for (const hash of hashes) {
    const alternatives = segmentAlternatives(build.translations[locale][hash]);
    const rendered = alternatives.some((segments) =>
      segments.every((segment) => text.includes(segment))
    );
    if (!rendered) missing.push(`${hash}: ${alternatives[0].join(' | ')}`);
  }
  return missing;
}

type PageVisit = {
  locale: string;
  firstPage: CapturedResponse[];
  lazyRoute: CapturedResponse[];
  requests: { url: string; resourceType: string }[];
  firstPageText: string;
  lazyRouteText: string;
  errors: string[];
};

/**
 * Opens the first page in a new context, then navigates client-side to the
 * lazy route, capturing every response of each phase.
 */
async function visitPages(
  browser: Browser,
  baseURL: string,
  locale: string,
  options: ContextOptions
): Promise<PageVisit> {
  const context = await newLocaleContext(browser, build, baseURL, options);
  const page = await context.newPage();
  const errors = collectErrors(page);
  const capture = new ResponseCapture(page);

  await page.goto('/');
  await expect(localeMarker(page, locale)).toBeVisible();
  await page.waitForLoadState('networkidle');
  const firstMark = await capture.mark();
  const firstPage = capture.responses.slice(0, firstMark.responses);
  const firstHashes = tableHashes(firstPage, locale).hashes;
  await expect
    .poll(async () =>
      missingRenderedText(
        await page.locator('body').innerText(),
        locale,
        firstHashes
      )
    )
    .toEqual([]);
  const firstPageText = await page.locator('body').innerText();

  await page.locator(`a[href="${twins!.lazyRoute}"]`).first().click();
  await expect(page).toHaveURL(new RegExp(`${twins!.lazyRoute}$`));
  await expect
    .poll(async () => {
      await capture.settle();
      const lazy = capture.responses.slice(firstMark.responses);
      return [...tableHashes(lazy, locale).hashes].filter(
        (hash) => !firstHashes.has(hash)
      ).length;
    })
    .toBeGreaterThan(0);
  await page.waitForLoadState('networkidle');
  await capture.settle();
  const lazyRoute = capture.responses.slice(firstMark.responses);
  const lazyHashes = [...tableHashes(lazyRoute, locale).hashes];
  await expect
    .poll(async () =>
      missingRenderedText(
        await page.locator('body').innerText(),
        locale,
        lazyHashes
      )
    )
    .toEqual([]);
  const lazyRouteText = await page.locator('body').innerText();
  await context.close();
  return {
    locale,
    firstPage,
    lazyRoute,
    requests: capture.requests,
    firstPageText,
    lazyRouteText,
    errors,
  };
}

/** `fr` → `fr-FR`: the language with its most likely region. */
function withRegion(locale: string): string {
  const maximized = new Intl.Locale(locale).maximize();
  return `${maximized.language}-${maximized.region}`;
}

const text = (responses: CapturedResponse[]) =>
  responses.map((response) => response.text).join('\n');

test('§9.1 selects the locale from the cookie, then Accept-Language / navigator.languages, else the default', async ({
  browser,
  baseURL,
}) => {
  const { defaultLocale, locales } = build.manifest;
  const nonDefault = locales.filter((locale) => locale !== defaultLocale);
  const cases: (ContextOptions & { expected: string })[] = [
    // Accept-Language / navigator.languages with a region, e.g. fr-FR → fr.
    ...nonDefault.map((locale) => ({
      browserLocale: withRegion(locale),
      expected: locale,
    })),
    // The cookie wins over the browser language.
    {
      browserLocale: nonDefault[0],
      cookieLocale: nonDefault[1],
      expected: nonDefault[1],
    },
    // A language without twins falls back to the default locale.
    { browserLocale: 'de-DE', expected: defaultLocale },
    { browserLocale: 'de-DE', cookieLocale: 'pt-BR', expected: defaultLocale },
  ];

  for (const { expected, ...options } of cases) {
    const context = await newLocaleContext(browser, build, baseURL!, options);
    const page = await context.newPage();
    const errors = collectErrors(page);
    const capture = new ResponseCapture(page);
    const documentResponse = await page.goto('/');
    await expect(localeMarker(page, expected)).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', expected);
    await page.waitForLoadState('networkidle');
    await capture.settle();

    const label = `${JSON.stringify(options)} → ${expected}`;
    expect(
      unexpectedScripts(build, expected, capture.responses),
      label
    ).toEqual([]);
    const entryTwins = build.manifest.entries.map(
      (entry) => build.manifest.twins[expected][entry]
    );
    const requested = new Set(
      capture.requests.map(({ url }) => fileOfUrl(url))
    );
    for (const entryTwin of entryTwins) {
      expect(requested.has(entryTwin), `${label}: ${entryTwin}`).toBe(true);
    }

    const html = (await documentResponse!.text()) ?? '';
    if (twins!.serving === 'server-helper') {
      // The server picked the locale: static tags, no bootstrap.
      expect(html).toMatch(new RegExp(`<html[^>]*\\blang="${expected}"`));
      expect(html).not.toContain('gt-locale-twins-data');
      const headers = documentResponse!.headers();
      expect(headers.vary).toMatch(/cookie/i);
      expect(headers.vary).toMatch(/accept-language/i);
      expect(headers['cache-control']).toMatch(/no-cache/);
    } else {
      // A static document: the browser bootstrap picks the twin.
      expect(html).toContain('gt-locale-twins-data');
    }
    expect(errors, label).toEqual([]);
    await context.close();
  }
});

test('§9.2/§9.3/§9.6/§9.8 each locale receives only its strings, per page, with no translation requests', async ({
  browser,
  baseURL,
}) => {
  const { defaultLocale } = build.manifest;
  for (const locale of build.manifest.locales) {
    const visit = await visitPages(browser, baseURL!, locale, {
      browserLocale: 'de-DE',
      cookieLocale: locale,
    });
    const all = [...visit.firstPage, ...visit.lazyRoute];
    const first = tableHashes(visit.firstPage, locale);
    const lazy = tableHashes(visit.lazyRoute, locale);
    expect(first.foreignTables, `${locale}: tables of other locales`).toEqual(
      []
    );
    expect(lazy.foreignTables, `${locale}: tables of other locales`).toEqual(
      []
    );

    // §9.2 both directions, over every byte received: the locale's strings
    // are there; every other locale's, the source locale included, are not.
    const isolation = checkIsolation(text(all), locale, build.segments, [
      ...build.attributed,
    ]);
    expect(isolation.missing, `${locale}: own strings`).toEqual([]);
    expect(isolation.foreign, `${locale}: other locales' strings`).toEqual([]);
    expect(
      checkIsolation(
        `${visit.firstPageText}\n${visit.lazyRouteText}`,
        locale,
        build.segments
      ).foreign,
      `${locale}: rendered text`
    ).toEqual([]);

    // §9.3 the lazy route's strings are not in the first page's bytes and
    // arrive in that locale's twins.
    const lazyOnly = [...lazy.hashes].filter((hash) => !first.hashes.has(hash));
    expect(lazyOnly.length, `${locale}: lazy route entries`).toBeGreaterThan(0);
    const firstText = text(visit.firstPage);
    const early = lazyOnly.flatMap((hash) =>
      build.segments[locale][hash].filter((segment) =>
        firstText.includes(segment)
      )
    );
    expect(early, `${locale}: lazy strings on the first page`).toEqual([]);
    const lazyFiles = visit.lazyRoute
      .filter((response) =>
        response.tables.some((table) =>
          Object.keys(table.entries).some((hash) => lazyOnly.includes(hash))
        )
      )
      .map((response) => response.file);
    expect(lazyFiles.length).toBeGreaterThan(0);
    const ownTwins = twinsOf(build, locale);
    for (const file of lazyFiles) {
      expect(ownTwins.has(file), `${locale}: ${file} is a twin`).toBe(true);
    }

    // Only this locale's twins and shared files are loaded.
    expect(unexpectedScripts(build, locale, all), locale).toEqual([]);

    // §9.6 no translation snapshot in the document, no translation request.
    const documents = visit.firstPage.filter(
      (response) => response.resourceType === 'document'
    );
    expect(documents).toHaveLength(1);
    expect(
      checkIsolation(documents[0].text, '', build.segments).foreign,
      `${locale}: strings in the document`
    ).toEqual([]);
    const origin = new URL(baseURL!).origin;
    const translationRequests = visit.requests
      .map(({ url }) => url)
      .filter(
        (url) =>
          new URL(url).origin !== origin ||
          /\/_gt\/|\.json(?:$|\?)/.test(new URL(url).pathname)
      );
    expect(translationRequests, `${locale}: translation requests`).toEqual([]);

    // §9.8 no served file holds an unfilled placeholder.
    const unfilled = all
      .filter((response) => UNFILLED_PLACEHOLDER_PATTERN.test(response.text))
      .map((response) => response.file);
    expect(unfilled, `${locale}: unfilled placeholders`).toEqual([]);

    // Unattributed control: rendered from the source text it keeps in code.
    const rendered = `${visit.firstPageText}\n${visit.lazyRouteText}`;
    for (const hash of build.unattributed) {
      for (const segment of textSegments(
        build.translations[defaultLocale][hash]
      )) {
        expect(rendered, `${locale}: unattributed ${hash}`).toContain(segment);
      }
    }
    expect(visit.errors, locale).toEqual([]);
  }
});

test('§9.4 switching reloads into the new locale’s twins; shared files come from the cache', async ({
  page,
}) => {
  const [from, to] = build.manifest.locales.filter(
    (locale) => locale !== build.manifest.defaultLocale
  );
  await page.context().addCookies([
    {
      name: build.localeCookieName,
      value: from,
      url: app.baseURL,
    },
  ]);
  const cache = await trackCacheHits(page);
  const capture = new ResponseCapture(page);
  await page.goto('/');
  await expect(localeMarker(page, from)).toBeVisible();
  await page.waitForLoadState('networkidle');
  const beforeSwitch = await capture.mark();
  cache.cached.clear();

  await Promise.all([
    page.waitForEvent('framenavigated'),
    page.getByRole('combobox', { name: localeSelectorName }).selectOption(to),
  ]);
  await expect(localeMarker(page, to)).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', to);
  await page.waitForLoadState('networkidle');
  await capture.settle();

  const after = capture.responses.slice(beforeSwitch.responses);
  expect(unexpectedScripts(build, to, after)).toEqual([]);
  const { foreignTables } = tableHashes(after, to);
  expect(foreignTables).toEqual([]);
  const toTwins = twinsOf(build, to);
  const scripts = after
    .map((response) => response.file)
    .filter((file) => /\.m?js$/.test(file));
  expect(scripts.some((file) => toTwins.has(file))).toBe(true);

  // Shared files were downloaded before the switch: the reload takes them
  // from the HTTP cache (they are immutable).
  const sharedUrls = after
    .filter((response) => build.report.shared.includes(response.file))
    .map((response) => response.url);
  expect(sharedUrls.length).toBeGreaterThan(0);
  for (const url of sharedUrls) {
    expect(cache.cached.has(url), `${url} from cache`).toBe(true);
  }

  const rendered = await page.locator('body').innerText();
  expect(checkIsolation(rendered, to, build.segments).foreign).toEqual([]);
  await cache.session.detach();
});

test('§9.10 report: translation bytes per page vs whole-locale loading', async ({
  browser,
  baseURL,
}, testInfo) => {
  const locales = build.manifest.locales.map((locale) => ({ locale }));
  const rows = [];
  for (const { locale } of locales) {
    const visit = await visitPages(browser, baseURL!, locale, {
      browserLocale: 'de-DE',
      cookieLocale: locale,
    });
    const first = tableHashes(visit.firstPage, locale);
    const lazy = tableHashes(visit.lazyRoute, locale);
    const wholeLocale = Buffer.byteLength(
      JSON.stringify(build.translations[locale])
    );
    const jsBytes = (responses: CapturedResponse[]) =>
      responses
        .filter((response) => /\.m?js$/.test(response.file))
        .reduce((sum, response) => sum + response.body.length, 0);
    rows.push({
      locale,
      wholeLocaleBytes: wholeLocale,
      firstPage: {
        translationBytes: first.bytes,
        entries: first.hashes.size,
        shareOfWholeLocale: first.bytes / wholeLocale,
        jsBytes: jsBytes(visit.firstPage),
      },
      lazyRoute: {
        translationBytes: lazy.bytes,
        entries: lazy.hashes.size,
        shareOfWholeLocale: lazy.bytes / wholeLocale,
        jsBytes: jsBytes(visit.lazyRoute),
      },
    });
  }
  const report = {
    app: appName,
    serving: twins!.serving,
    lazyRoute: twins!.lazyRoute,
    outputMultiplier: build.report.outputMultiplier,
    sharedBytes: build.report.sharedBytes,
    twinnedBytes: build.report.twinnedBytes,
    twinBytes: build.report.twinBytes,
    attributedEntries: build.attributed.size,
    unattributedEntries: build.unattributed.length,
    locales: rows,
  };
  const file = writeTwinReport(appName!, report);
  await testInfo.attach('locale-twins-report', {
    path: file,
    contentType: 'application/json',
  });
  for (const row of rows) {
    expect(row.firstPage.translationBytes).toBeGreaterThan(0);
    expect(row.lazyRoute.translationBytes).toBeGreaterThan(0);
  }
  expect(report.outputMultiplier).toBeGreaterThan(1);
});
