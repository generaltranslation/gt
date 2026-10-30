import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultLocaleCookieName } from 'gt-i18n/internal/cookies';
import type {
  Browser,
  BrowserContext,
  CDPSession,
  Page,
  Response,
} from '@playwright/test';
import {
  attributedHashes,
  checkAttribution,
  derivedEntryHashes,
  distinctiveSegments,
  findFilledTables,
  readTranslations,
  readTwinManifest,
  readTwinReport,
  type FilledTable,
  type TranslationFile,
  type TwinManifest,
  type TwinReport,
} from '../locale-twins/twinOutput';

const packageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const repositoryRoot = path.resolve(packageDir, '../../..');

/** The `twins` field of a locale twin app in `apps.mjs`. */
export type TwinAppConfig = {
  /** App directory, relative to the repository root. */
  appDir: string;
  /** Client output directory, relative to the app. */
  clientDir: string;
  /** Directory with `[locale].json`, relative to the app. */
  translationsDir: string;
  /**
   * How documents are served: a static document with the browser bootstrap,
   * `gt-react/locale-twins` on a server, or TanStack Start server rendering.
   */
  serving: 'static' | 'server-helper' | 'tanstack';
  /** A client-side route whose component is lazy (its own chunk). */
  lazyRoute: string;
  /** A route the server never renders (TanStack Start `ssr: false`). */
  clientOnlyRoute?: string;
  /**
   * A server-rendered route whose loader returns `msg()` values that its
   * component renders with `useMessages()` inside
   * `[data-testid="loader-messages"]`, linked from every page.
   */
  loaderRoute?: string;
  /**
   * Query parameter of the app's test-only hydration mismatch control: it
   * serves that locale's twins while the server renders the request locale.
   */
  mismatchControlParam?: string;
};

/** What the tests know about a build, read from its output on disk. */
export type TwinBuild = {
  clientDir: string;
  manifest: TwinManifest;
  report: TwinReport;
  translations: Record<string, TranslationFile>;
  /** Entries the build put in twins. */
  attributed: Set<string>;
  /** Translation file entries that keep their source text in code. */
  unattributed: string[];
  /** Per locale and hash: segments that identify that locale. */
  segments: Record<string, Record<string, string[]>>;
  /** Locale cookie name the app reads. */
  localeCookieName: string;
};

export function readTwinBuild(config: TwinAppConfig): TwinBuild {
  const appDir = path.join(repositoryRoot, config.appDir);
  const clientDir = path.join(appDir, config.clientDir);
  const manifest = readTwinManifest(clientDir);
  const translations = readTranslations(
    path.join(appDir, config.translationsDir),
    manifest.locales
  );
  const attributed = attributedHashes(clientDir, manifest);
  const report = readTwinReport(appDir);
  const source = translations[manifest.defaultLocale];
  // The string lists below come from the translation files: a build that
  // attributes fewer entries than expected fails here instead of shrinking them
  const problems = checkAttribution({ source, attributed, report });
  if (problems.length > 0) {
    throw new Error(
      `The locale twin build of ${config.appDir} is incomplete:\n${problems.join('\n')}`
    );
  }
  return {
    clientDir,
    manifest,
    report,
    translations,
    attributed,
    unattributed: [...derivedEntryHashes(source)],
    segments: distinctiveSegments(translations, attributed),
    localeCookieName: readLocaleCookieName(clientDir),
  };
}

/**
 * The cookie name a static SPA document carries (the build writes it into the
 * bootstrap data); server-rendered apps use GT's canonical cookie name.
 */
function readLocaleCookieName(clientDir: string): string {
  const document = path.join(clientDir, 'index.html');
  if (!fs.existsSync(document)) return defaultLocaleCookieName;
  const html = fs.readFileSync(document, 'utf8');
  const cookie = /"localeCookieName":"([^"]+)"/.exec(html);
  if (!cookie) throw new Error('The built document names no locale cookie');
  return cookie[1];
}

/** Twin and shared file names (outDir-relative) and helpers to classify URLs. */
export function fileOfUrl(url: string): string {
  return decodeURIComponent(new URL(url).pathname).replace(/^\//, '');
}

export function twinsOf(build: TwinBuild, locale: string): Set<string> {
  return new Set(Object.values(build.manifest.twins[locale]));
}

/** One response the browser received, with its body. */
export type CapturedResponse = {
  url: string;
  file: string;
  status: number;
  resourceType: string;
  headers: Record<string, string>;
  body: Buffer;
  text: string;
  tables: FilledTable[];
};

/**
 * Records every response of a page (documents, scripts, styles, fetches)
 * with its body. Call `mark()` to start a new phase and `settle()` before
 * reading.
 */
export class ResponseCapture {
  readonly responses: CapturedResponse[] = [];
  readonly requests: { url: string; resourceType: string }[] = [];
  private readonly pending: Promise<void>[] = [];

  constructor(page: Page) {
    page.on('request', (request) => {
      this.requests.push({
        url: request.url(),
        resourceType: request.resourceType(),
      });
    });
    page.on('response', (response) => {
      this.pending.push(this.record(response));
    });
  }

  private async record(response: Response) {
    const body = await response.body().catch(() => Buffer.alloc(0));
    const text = body.toString('utf8');
    this.responses.push({
      url: response.url(),
      file: fileOfUrl(response.url()),
      status: response.status(),
      resourceType: response.request().resourceType(),
      headers: response.headers(),
      body,
      text,
      tables: /\.m?js$/.test(new URL(response.url()).pathname)
        ? findFilledTables(text)
        : [],
    });
  }

  /** Index to slice later phases from. */
  async mark(): Promise<{ responses: number; requests: number }> {
    await this.settle();
    return {
      responses: this.responses.length,
      requests: this.requests.length,
    };
  }

  async settle() {
    while (this.pending.length > 0) {
      await Promise.all(this.pending.splice(0));
    }
  }
}

/** Every JS file a page requested must be one of its locale's twins or shared. */
export function unexpectedScripts(
  build: TwinBuild,
  locale: string,
  responses: CapturedResponse[]
): string[] {
  const allowed = new Set([...twinsOf(build, locale), ...build.report.shared]);
  return responses
    .filter((response) => /\.m?js$/.test(response.file))
    .map((response) => response.file)
    .filter((file) => !allowed.has(file));
}

/** Hashes of the tables in `responses`, checking they are all `locale`'s. */
export function tableHashes(
  responses: CapturedResponse[],
  locale: string
): { hashes: Set<string>; foreignTables: string[]; bytes: number } {
  const hashes = new Set<string>();
  const foreignTables: string[] = [];
  let bytes = 0;
  for (const response of responses) {
    for (const table of response.tables) {
      if (table.locale !== locale) {
        foreignTables.push(`${response.file}: ${table.locale}`);
      }
      bytes += table.bytes;
      for (const hash of Object.keys(table.entries)) hashes.add(hash);
    }
  }
  return { hashes, foreignTables, bytes };
}

export type ContextOptions = {
  /** Browser locale: `navigator.languages` and `Accept-Language`. */
  browserLocale: string;
  /** Value of the GT locale cookie. */
  cookieLocale?: string;
};

export async function newLocaleContext(
  browser: Browser,
  build: TwinBuild,
  baseURL: string,
  { browserLocale, cookieLocale }: ContextOptions,
  { javaScriptEnabled = true }: { javaScriptEnabled?: boolean } = {}
): Promise<BrowserContext> {
  const context = await browser.newContext({
    baseURL,
    locale: browserLocale,
    javaScriptEnabled,
  });
  if (cookieLocale) {
    await context.addCookies([
      { name: build.localeCookieName, value: cookieLocale, url: baseURL },
    ]);
  }
  return context;
}

/**
 * Records the URLs Chromium served from its HTTP cache (no request reached
 * the server). Chromium reports these with `Network.requestServedFromCache`.
 */
export async function trackCacheHits(page: Page): Promise<{
  session: CDPSession;
  cached: Set<string>;
}> {
  const session = await page.context().newCDPSession(page);
  const cached = new Set<string>();
  const urls = new Map<string, string>();
  session.on('Network.requestWillBeSent', (event) => {
    urls.set(event.requestId, event.request.url);
  });
  session.on('Network.requestServedFromCache', (event) => {
    const url = urls.get(event.requestId);
    if (url) cached.add(url);
  });
  await session.send('Network.enable');
  return { session, cached };
}

/** Writes the §9.10 report for an app under `.turbo/playwright/`. */
export function writeTwinReport(appName: string, report: unknown): string {
  const dir = path.join(
    repositoryRoot,
    '.turbo/playwright/locale-twins-report'
  );
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${appName}.json`);
  fs.writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
}
