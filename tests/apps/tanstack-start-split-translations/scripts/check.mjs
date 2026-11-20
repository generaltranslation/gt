// Builds the app with and without split translations, serves each build and
// drives it in headless Chromium:
//   node scripts/check.mjs [name...]
// Each name selects the checks whose title holds it; without one, all run.
// Prints one line per check and exits with 1 when any fails.
//
// Every message of the app is in an element with `data-m`, whose `data-src`
// is what the source locale renders. A translation is the source in upper
// case (fr) or lower case (de), so "right" below means: every such element
// shows its `data-src` in the case of the page's locale. An observer that is
// installed before any script of the page records each element that ever
// shows anything else, which is how a flash of source text is caught.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { serve, serveAssets } from './serve.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const only = process.argv.slice(2);

// The routes of the app, and what marks the page of each
const ROUTES = {
  '/': 'home',
  '/reports': 'reports',
  '/settings': 'settings',
  '/client-only': 'client-only',
  '/data-only': 'data-only',
  '/deferred': 'deferred',
};

const SPLITS = {
  off: { GT_SPLIT_TRANSLATIONS: 'false' },
  chunk: { GT_SPLIT_TRANSLATIONS: 'true', GT_SPLIT_TRANSLATIONS_BY: 'chunk' },
  'chunk, minified ids': {
    GT_SPLIT_TRANSLATIONS: 'true',
    GT_SPLIT_TRANSLATIONS_BY: 'chunk',
    GT_MINIFY_HASHES: 'true',
  },
  // Without a cost per request, or an app this small is one file
  module: {
    GT_SPLIT_TRANSLATIONS: 'true',
    GT_SPLIT_TRANSLATIONS_BY: 'module',
    CHECK_REQUEST_COST: '0',
  },
  'module, minified ids': {
    GT_SPLIT_TRANSLATIONS: 'true',
    GT_SPLIT_TRANSLATIONS_BY: 'module',
    GT_MINIFY_HASHES: 'true',
    CHECK_REQUEST_COST: '0',
  },
};

// ===== Reporting ===== //

let failed = 0;
function check(title, passed, details) {
  if (!passed) failed++;
  console.log(
    `${passed ? 'ok  ' : 'FAIL'} ${title}${passed || !details ? '' : `\n     ${JSON.stringify(details)}`}`
  );
}

// ===== Build and serve ===== //

const built = new Set();

/** Builds the app into .check/<name> with `env`, once, and returns that directory. */
function build(name, env = {}) {
  const directory = join(root, '.check', name.replace(/[^a-z0-9]+/gi, '-'));
  if (built.has(directory)) return directory;
  built.add(directory);
  execFileSync('pnpm', ['exec', 'vite', 'build', '--logLevel', 'error'], {
    cwd: root,
    stdio: ['ignore', 'ignore', 'inherit'],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      GT_SPLIT_TRANSLATIONS: 'false',
      GT_SPLIT_TRANSLATIONS_BY: '',
      GT_MINIFY_HASHES: 'false',
      CHECK_OUT_DIR: directory,
      ...env,
    },
  });
  return directory;
}

// ===== A page ===== //

const expected = (source, locale) =>
  locale === 'fr'
    ? source.toUpperCase()
    : locale === 'de'
      ? source.toLowerCase()
      : source;

const browser = await chromium.launch();

/**
 * Opens a page for a visitor whose cookie asks for `locale`, or who has no
 * cookie when it is undefined. `renders` is the locale the pages are
 * expected in, when not that one.
 */
async function open(origin, locale, renders = locale) {
  const context = await browser.newContext({ locale: 'en-US' });
  if (locale !== undefined) {
    await context.addCookies([
      { name: 'generaltranslation.locale', value: locale, url: origin },
    ]);
  }
  // Before any script of the page: what every message ever shows
  await context.addInitScript(() => {
    window.__shown = [];
    const look = () => {
      for (const element of document.querySelectorAll('[data-m]')) {
        const text = element.textContent;
        // An element whose source is server data has none until it arrives
        if (!element.hasAttribute('data-src')) continue;
        if (text !== '' && element.__last !== text) {
          element.__last = text;
          window.__shown.push([element.getAttribute('data-src'), text]);
        }
      }
    };
    new MutationObserver(look).observe(document, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  });
  const page = await context.newPage();
  const problems = [];
  const requests = [];
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      problems.push(message.text().slice(0, 200));
    }
  });
  page.on('pageerror', (error) => problems.push(error.message.slice(0, 200)));
  page.on('response', (response) => {
    const { pathname } = new URL(response.url());
    requests.push({ pathname, status: response.status() });
  });
  let locale_ = renders;
  const visitor = {
    page,
    requests,
    problems,
    /** The translation files the page has requested since the last call. */
    takeTranslationRequests() {
      return requests
        .splice(0)
        .filter(({ pathname }) => pathname.endsWith('.json'))
        .map(({ pathname, status }) => `${status} ${pathname}`);
    },
    setLocale(next) {
      locale_ = next;
    },
    /** Waits for the page of `route`, hydrated and settled. */
    async settle(route) {
      await page.waitForSelector(`[data-page="${ROUTES[route]}"]`);
      await page.waitForFunction(() => {
        const nav = document.querySelector('[data-nav]');
        return (
          !!nav && Object.keys(nav).some((key) => key.startsWith('__react'))
        );
      });
      await page.waitForLoadState('networkidle');
      if (route === '/deferred') await page.waitForSelector('[data-deferred]');
    },
    async visit(route, path = route) {
      await page.goto(origin + path);
      await visitor.settle(route);
    },
    async navigate(route) {
      await page.click(`[data-link="${route}"]`);
      await visitor.settle(route);
    },
    /**
     * The messages that show another text than their locale's, and unless
     * `nowOnly`, those that ever showed one.
     */
    async wrong(nowOnly = false) {
      const { now, shown } = await page.evaluate(() => ({
        now: [...document.querySelectorAll('[data-m][data-src]')].map(
          (element) => [element.getAttribute('data-src'), element.textContent]
        ),
        shown: window.__shown.splice(0),
      }));
      return {
        count: now.length,
        wrong: [...now, ...(nowOnly ? [] : shown)]
          .filter(([source, text]) => text !== expected(source, locale_))
          .map(([, text]) => text),
      };
    },
    close: () => context.close(),
  };
  return visitor;
}

/**
 * Reports whether every message of the current page is, and always was,
 * right. With `nowOnly`, only whether it is: a prerendered shell shows the
 * locale it was built in until the browser has loaded the visitor's.
 */
async function checkMessages(title, visitor, nowOnly = false) {
  const { count, wrong } = await visitor.wrong(nowOnly);
  check(
    `${title}: ${count} messages right${nowOnly ? '' : ', none ever wrong'}`,
    count > 0 && wrong.length === 0,
    wrong.slice(0, 4)
  );
}

/**
 * A first visit of each route, a navigation out of it and back into it.
 * `isShell`: the first page is a prerendered shell in the source locale.
 */
async function walk(title, origin, locale, renders = locale, isShell = false) {
  for (const route of Object.keys(ROUTES)) {
    const visitor = await open(origin, locale, renders);
    await visitor.visit(route);
    await checkMessages(
      `${title}, ${locale}: first visit of ${route}`,
      visitor,
      isShell
    );
    const other = route === '/' ? '/settings' : '/';
    await visitor.navigate(other);
    await checkMessages(`${title}, ${locale}: ${route} to ${other}`, visitor);
    await visitor.navigate(route);
    await checkMessages(`${title}, ${locale}: ${other} to ${route}`, visitor);
    check(
      `${title}, ${locale}: no console error or hydration warning at ${route}`,
      visitor.problems.length === 0,
      visitor.problems.slice(0, 3)
    );
    await visitor.close();
  }
}

const selected = (title) =>
  only.length === 0 || only.some((name) => title.includes(name));

// ===== Each split ===== //

for (const [name, env] of Object.entries(SPLITS)) {
  const title = `split ${name}`;
  if (!selected(title)) continue;
  const server = await serve(build(title, env));
  const splits = name !== 'off';
  for (const locale of ['fr', 'en']) await walk(title, server.origin, locale);

  // What a first visit downloads
  const visitor = await open(server.origin, 'fr');
  const response = await visitor.page.goto(`${server.origin}/reports`);
  const html = await response.text();
  await visitor.settle('/reports');
  check(
    `${title}: the HTML of /reports holds its own translations${splits ? ' and not those of /settings' : ''}`,
    html.includes('OPEN THE WEEKLY REPORT') &&
      // In the page's data, not its markup: /reports does not render it
      html.includes('CHANGE YOUR PASSWORD') === !splits
  );
  const first = visitor.takeTranslationRequests();
  check(
    `${title}: a first visit requests no file of translations${name.startsWith('module') ? " but the locale's map" : ''}`,
    first.every((request) => /gt-map\.fr\./.test(request)) &&
      (name.startsWith('module') || first.length === 0),
    first
  );

  // Preloading on intent requests a route's translations with its chunks
  await visitor.page.hover('[data-link="/settings"]');
  await visitor.page.waitForLoadState('networkidle');
  await visitor.page.waitForTimeout(200);
  const preloaded = visitor.takeTranslationRequests();
  check(
    `${title}: hovering a link ${splits ? 'requests the translations of its route' : 'requests no translations'}`,
    preloaded.every((request) => request.startsWith('200 ')) &&
      preloaded.length > 0 === splits,
    preloaded
  );
  await visitor.navigate('/settings');
  check(
    `${title}: the click after it requests nothing more`,
    visitor.takeTranslationRequests().length === 0
  );
  await checkMessages(`${title}: /settings after a hover`, visitor);

  // A lazily imported component
  await visitor.navigate('/reports');
  await visitor.page.click('[data-open-dialog]');
  await visitor.page.waitForSelector('[data-component="dialog"]');
  await visitor.page.waitForLoadState('networkidle');
  await checkMessages(`${title}: a lazily imported component`, visitor);

  // Switching locale reloads the page in it
  await visitor.page.locator('select').first().selectOption('de');
  await visitor.page.waitForFunction(
    () => document.documentElement.lang === 'de'
  );
  visitor.setLocale('de');
  await visitor.page.evaluate(() => window.__shown.splice(0));
  await visitor.settle('/reports');
  await checkMessages(`${title}: after switching to de`, visitor);
  await visitor.navigate('/settings');
  await checkMessages(`${title}: a navigation in de`, visitor);
  check(
    `${title}: no console error through all of it`,
    visitor.problems.length === 0,
    visitor.problems.slice(0, 3)
  );
  await visitor.close();
  await server.close();
}

// ===== Rendering modes ===== //

const SPLIT = SPLITS['chunk, minified ids'];

// A prerendered shell: one static page, in the source locale, that every
// visitor gets for every route. The browser then renders the visitor's own
// locale, which it has to load itself.
for (const [name, env] of Object.entries({ off: SPLITS.off, on: SPLIT })) {
  const title = `shell, split ${name}`;
  if (!selected(title)) continue;
  const server = await serve(build(title, { ...env, CHECK_SPA: 'true' }), {
    pages: 'shell',
  });
  for (const locale of ['fr', 'en']) {
    await walk(title, server.origin, locale, locale, true);
  }
  await server.close();
}

// Static prerendering: every route is also a static page, rendered at build
// time in the source locale. Without locale routing the page stays in that
// locale for every visitor, as without the split.
for (const [name, env] of Object.entries({ off: SPLITS.off, on: SPLIT })) {
  const title = `prerendered, split ${name}`;
  if (!selected(title)) continue;
  const server = await serve(
    build(title, { ...env, CHECK_PRERENDER: 'true' }),
    { pages: 'prerendered' }
  );
  for (const locale of ['fr', 'en']) {
    await walk(title, server.origin, locale, 'en');
  }
  await server.close();
}

// ===== App setups ===== //

// Locale routing: the locale is the first segment of the path, and the
// routes and links of the app stay free of it.
for (const [name, env] of Object.entries({ off: SPLITS.off, on: SPLIT })) {
  const title = `locale routing, split ${name}`;
  if (!selected(title)) continue;
  const routing = { ...env, CHECK_CONFIG: 'gt.config.locale-routing.json' };
  const server = await serve(build(title, routing));
  for (const [path, locale] of [
    ['/fr/reports', 'fr'],
    ['/reports', 'en'],
  ]) {
    // No cookie: the path alone says the locale
    const visitor = await open(server.origin, undefined, locale);
    await visitor.visit('/reports', path);
    await checkMessages(`${title}: first visit of ${path}`, visitor);
    await visitor.navigate('/settings');
    const prefix = locale === 'en' ? '' : `/${locale}`;
    check(
      `${title}: a navigation from ${path} stays in the locale's paths`,
      new URL(visitor.page.url()).pathname === `${prefix}/settings`,
      visitor.page.url()
    );
    await checkMessages(`${title}: ${path} to /settings`, visitor);
    await visitor.navigate('/reports');
    await checkMessages(`${title}: /settings back to ${path}`, visitor);
    // Switching locale navigates to the other locale's path
    await visitor.page.locator('select').first().selectOption('de');
    await visitor.page.waitForURL(`${server.origin}/de/reports`);
    visitor.setLocale('de');
    await visitor.page.evaluate(() => window.__shown.splice(0));
    await visitor.settle('/reports');
    await checkMessages(`${title}: ${path} switched to /de/reports`, visitor);
    await visitor.navigate('/client-only');
    await checkMessages(`${title}: a navigation in de`, visitor);
    check(
      `${title}: no console error from ${path} on`,
      visitor.problems.length === 0,
      visitor.problems.slice(0, 3)
    );
    await visitor.close();
  }
  await server.close();

  // Prerendered with locale routing, a translated locale has pages of its own
  const prerendered = await serve(
    build(`${title}, prerendered`, { ...routing, CHECK_PRERENDER: 'true' }),
    { pages: 'prerendered' }
  );
  const visitor = await open(prerendered.origin, undefined, 'fr');
  const response = await visitor.page.goto(`${prerendered.origin}/fr/reports`);
  check(
    `${title}: /fr/reports is a prerendered page in fr`,
    (await response.text()).includes('OPEN THE WEEKLY REPORT') &&
      existsSync(
        join(
          root,
          '.check',
          `${title}, prerendered`.replace(/[^a-z0-9]+/gi, '-'),
          'client/fr/reports/index.html'
        )
      )
  );
  await visitor.settle('/reports');
  await checkMessages(`${title}: the prerendered /fr/reports`, visitor);
  await visitor.navigate('/settings');
  await checkMessages(`${title}: a navigation out of it`, visitor);
  check(
    `${title}: no console error on the prerendered page`,
    visitor.problems.length === 0,
    visitor.problems.slice(0, 3)
  );
  await visitor.close();
  await prerendered.close();
}

// A base other than `/`: the app, its chunks and its translation files are
// all under it.
for (const [name, env] of Object.entries({ off: SPLITS.off, on: SPLIT })) {
  const title = `base, split ${name}`;
  if (!selected(title)) continue;
  const server = await serve(build(title, { ...env, CHECK_BASE: '/app/' }), {
    base: '/app/',
  });
  for (const locale of ['fr', 'en']) {
    await walk(title, `${server.origin}/app`, locale);
  }
  await server.close();
}

// Assets on another origin: src/server.ts rewrites the URLs of the chunks
// with `transformAssets`, and the app's own origin has none of them.
for (const [name, env] of Object.entries({ off: SPLITS.off, on: SPLIT })) {
  const title = `cdn, split ${name}`;
  if (!selected(title)) continue;
  const directory = build(title, env);
  const cdn = await serveAssets(directory);
  // Read by src/server.ts when the build's server is loaded
  process.env.CHECK_CDN = cdn.origin;
  const server = await serve(directory, { assets: false });
  for (const locale of ['fr', 'en']) await walk(title, server.origin, locale);
  await server.close();
  await cdn.close();
  delete process.env.CHECK_CDN;
}

// The dictionary (key-based) API of gt-tanstack-start/compat. Its entries
// are no call site the build can place, so they are in the unsplit file.
for (const [name, env] of Object.entries({ off: SPLITS.off, on: SPLIT })) {
  const title = `dictionary, split ${name}`;
  if (!selected(title)) continue;
  const server = await serve(
    build(title, { ...env, VITE_CHECK_COMPAT: 'true' })
  );
  for (const locale of ['fr', 'en']) {
    const visitor = await open(server.origin, locale);
    await visitor.page.goto(`${server.origin}/dictionary`);
    await visitor.page.waitForSelector('[data-page="dictionary"]');
    await visitor.page.waitForLoadState('networkidle');
    await checkMessages(
      `${title}, ${locale}: first visit of /dictionary`,
      visitor
    );
    await visitor.navigate('/reports');
    await checkMessages(
      `${title}, ${locale}: /dictionary to /reports`,
      visitor
    );
    await visitor.page.click('[data-link="/dictionary"]');
    await visitor.page.waitForSelector('[data-page="dictionary"]');
    await visitor.page.waitForLoadState('networkidle');
    await checkMessages(
      `${title}, ${locale}: /reports to /dictionary`,
      visitor
    );
    check(
      `${title}, ${locale}: no console error`,
      visitor.problems.length === 0,
      visitor.problems.slice(0, 3)
    );
    await visitor.close();
  }
  await server.close();
}

await browser.close();
console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
