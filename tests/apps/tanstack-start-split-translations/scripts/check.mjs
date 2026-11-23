// Builds the app with and without split translations, serves each build and
// drives it in headless Chromium:
//   node scripts/check.mjs [name...]
// Each name selects the checks whose title holds it; without one, all run.
// Prints one line per check and exits with 1 when any fails.
//
// Every message of the app is in an element with `data-m`, whose `data-src`
// is what the source locale renders. A translation is the source in upper
// case (fr) or lower case (de), so "right" below means: every such element
// shows its `data-src` in the case of the page's locale, and never showed
// anything else (see scripts/visitor.mjs).
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { serve } from './serve.mjs';
import { createOpen, createReporter, USER_AGENT } from './visitor.mjs';

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
  // Each file named by the hash of what it holds, with a map of the names
  'chunk, named by a map': {
    GT_SPLIT_TRANSLATIONS: 'true',
    GT_SPLIT_TRANSLATIONS_BY: 'chunk',
    CHECK_NAMING: 'map',
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

const { check, finish } = createReporter();

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

const open = createOpen({
  browser,
  routes: ROUTES,
  expected,
  // The part of the page that streams after it
  settled: (page, route) =>
    route === '/deferred' ? page.waitForSelector('[data-deferred]') : undefined,
});

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
  // Once the page has hydrated it asks which files an import needs, for
  // the first navigation: the locale's map, or the file of the entry. A
  // build by chunk with a map leaves that to the first import.
  const lists = name.startsWith('module')
    ? /gt-map\.fr\./
    : /index-[^.]+\.fr\./;
  const asks = splits && !name.includes('named by a map');
  check(
    `${title}: a first visit requests no file of translations${asks ? ' but the one that lists the files of each import' : ''}`,
    first.length === (asks ? 1 : 0) &&
      first.every((request) => lists.test(request)),
    first
  );

  // A msg() in code that only the server runs, sent to the browser as data
  // and rendered there with useMessages(): the build can tie it to no client
  // chunk, so it is an unsplit message, which every page gets.
  {
    const directory = join(build(title, env), 'client', 'assets');
    const read = (isFile) =>
      readdirSync(directory)
        .filter(isFile)
        .map((name) => readFileSync(join(directory, name), 'utf8'));
    check(
      `${title}: no chunk of the browser holds the msg() of the server function`,
      !read((name) => name.endsWith('.js')).some((chunk) =>
        chunk.includes('Checked by the server')
      )
    );
    if (splits) {
      const unsplit = read((name) => name.startsWith('gt-unsplit.fr.'));
      check(
        `${title}: the unsplit file holds its translation`,
        unsplit.length === 1 && unsplit[0].includes('CHECKED BY THE SERVER'),
        unsplit
      );
    }
    // The same server function sends a second msg(), with the text of a t
    // template of the home page, whose chunk this page does not load: the
    // build ties that text to the home page's file, and the browser still
    // reads the server's message by its hash.
    const sent = (page) =>
      page.evaluate(() =>
        ['[data-notice]', '[data-shared]'].map(
          (selector) => document.querySelector(selector)?.textContent
        )
      );
    const SENT = ['CHECKED BY THE SERVER', 'WELCOME BACK'];
    const streamed = await open(server.origin, 'fr');
    await streamed.visit('/deferred');
    const first = await sent(streamed.page);
    check(
      `${title}: both messages the server sends are translated on a first visit`,
      first.join() === SENT.join(),
      first
    );
    await streamed.close();
    await visitor.navigate('/deferred');
    const navigated = await sent(visitor.page);
    check(
      `${title}: both are translated after a navigation`,
      navigated.join() === SENT.join(),
      navigated
    );
    await visitor.navigate('/reports');
    visitor.takeTranslationRequests();
  }

  // The server sends /deferred in parts: the page with its fallback first,
  // and what the server function returns once it has. A check that only
  // ever got whole pages would not see what hydrates in between.
  {
    const answer = await fetch(`${server.origin}/deferred`, {
      headers: {
        cookie: 'generaltranslation.locale=fr',
        'user-agent': USER_AGENT,
      },
    });
    const decoder = new TextDecoder();
    const parts = [];
    for await (const part of answer.body) parts.push(decoder.decode(part));
    check(
      `${title}: /deferred arrives before its deferred data, which follows in a later part`,
      parts.length > 1 &&
        parts[0].includes('data-fallback') &&
        !parts[0].includes('data-deferred') &&
        parts.slice(1).join('').includes('data-deferred'),
      parts.map((part) => part.length)
    );
  }

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

// ===== A deploy while a page is open ===== //

/**
 * Writes the app's translations into .check/deployed, with one of them
 * changed when `changed`, and returns a config that reads them from there.
 * Two builds with that config differ in a translation alone: the config, and
 * so the JavaScript that holds it, is the same. The changed message is of
 * the home page, which the check below does not visit.
 */
function writeTranslations(changed) {
  const directory = join(root, '.check', 'deployed');
  mkdirSync(join(directory, '_gt'), { recursive: true });
  for (const locale of ['fr', 'de']) {
    const translations = readFileSync(
      join(root, 'src', '_gt', `${locale}.json`),
      'utf8'
    );
    writeFileSync(
      join(directory, '_gt', `${locale}.json`),
      changed ? translations.replace(/welcome back/i, '$& again') : translations
    );
  }
  const config = JSON.parse(readFileSync(join(root, 'gt.config.json'), 'utf8'));
  config.files.gt.output = '.check/deployed/_gt/[locale].json';
  writeFileSync(join(directory, 'gt.config.json'), JSON.stringify(config));
  return '.check/deployed/gt.config.json';
}

// The host keeps no file of the build before: a page that was open through
// the deploy asks for translation files by names the host no longer has.
for (const name of ['chunk, minified ids', 'module, minified ids']) {
  const title = `deploy, split ${name}`;
  if (!selected(title)) continue;
  const before = build(`${title}, before`, {
    ...SPLITS[name],
    CHECK_CONFIG: writeTranslations(false),
  });
  const after = build(`${title}, after`, {
    ...SPLITS[name],
    CHECK_CONFIG: writeTranslations(true),
  });
  const names = (directory, extension) =>
    readdirSync(join(directory, 'client', 'assets'))
      .filter((file) => file.endsWith(extension))
      .sort()
      .join();
  check(
    `${title}: a changed translation renames translation files and no chunk`,
    names(before, '.json') !== names(after, '.json') &&
      names(before, '.js') === names(after, '.js')
  );
  const server = await serve(before);
  const visitor = await open(server.origin, 'fr');
  await visitor.visit('/reports');
  await checkMessages(`${title}: /reports before the deploy`, visitor);
  await server.deploy(after);
  visitor.takeTranslationRequests();
  await visitor.navigate('/settings');
  await checkMessages(`${title}: /settings after the deploy`, visitor);
  const requested = visitor.takeTranslationRequests();
  check(
    `${title}: every file the navigation needed arrived, by its old name or its new one`,
    requested.some((request) => request.startsWith('200 ')),
    requested
  );
  await visitor.navigate('/client-only');
  await checkMessages(
    `${title}: a second navigation after the deploy`,
    visitor
  );
  // A file that is gone is a failed request in the console, and nothing else is
  const others = visitor.problems.filter((problem) => !problem.includes('404'));
  check(`${title}: no other console error`, others.length === 0, others);
  await visitor.close();
  await server.close();
}

// ===== Loaders ===== //

// A loader that translates with getGT() is in the entry chunk by default, so
// every page carries the loader messages of every route. With the router's
// own code splitting of loaders they are in a file of their route.
{
  const title = 'loaders split by the router';
  if (selected(title)) {
    const split = SPLITS['chunk, minified ids'];
    const inEntry = (directory) => {
      const assets = join(directory, 'client', 'assets');
      const manifest = JSON.parse(
        readFileSync(join(assets, 'gt-chunk-translations.json'), 'utf8')
      );
      const [entry] = Object.values(manifest.entries);
      return readFileSync(
        join(directory, 'client', entry.translations.fr),
        'utf8'
      ).includes('REPORTS OVERVIEW');
    };
    const directory = build(title, { ...split, CHECK_SPLIT_LOADERS: 'true' });
    check(
      `${title}: the title a loader translates is in the entry's file by default, and not with it`,
      inEntry(build('split chunk, minified ids', split)) && !inEntry(directory)
    );
    const server = await serve(directory);
    for (const locale of ['fr', 'en']) await walk(title, server.origin, locale);
    await server.close();
  }
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

// A shell rendered in a translated locale: it hydrates in that locale, with
// the translations it was rendered with, before the browser renders the
// visitor's own.
for (const [name, env] of Object.entries({ off: SPLITS.off, on: SPLIT })) {
  const title = `shell rendered in fr, split ${name}`;
  if (!selected(title)) continue;
  const directory = build(title, {
    ...env,
    CHECK_SPA: 'true',
    CHECK_SHELL_LOCALE: 'fr',
  });
  check(
    `${title}: the shell is in fr`,
    readFileSync(join(directory, 'client', '_shell.html'), 'utf8').includes(
      'RENDERED IN THE BROWSER'
    )
  );
  const server = await serve(directory, { pages: 'shell' });
  for (const locale of ['en', 'fr']) {
    await walk(title, server.origin, locale, locale, true);
  }
  await server.close();
}

// A loadTranslations of the app's own can return other translations than
// the files the build writes a navigation's translations from, so a build
// that splits refuses it.
{
  const title = 'a loadTranslations of the app';
  if (selected(title)) {
    const run = (name, env) => {
      try {
        execFileSync('pnpm', ['exec', 'vite', 'build', '--logLevel', 'error'], {
          cwd: root,
          stdio: 'pipe',
          env: {
            ...process.env,
            NODE_ENV: 'production',
            GT_SPLIT_TRANSLATIONS_BY: '',
            GT_MINIFY_HASHES: 'false',
            CHECK_OUT_DIR: join(root, '.check', name),
            CHECK_LOADER: 'scripts/loadTranslations.ts',
            ...env,
          },
        });
        return '';
      } catch (error) {
        return String(error.stderr);
      }
    };
    const failure = run('loader-split-on', { GT_SPLIT_TRANSLATIONS: 'true' });
    check(
      `${title}: fails a build that splits translations, and says where they have to come from`,
      failure.includes(
        'experimentalSplitTranslations cannot be used with the loadTranslations of scripts/loadTranslations.ts'
      ) && failure.includes('files.gt.output'),
      failure.slice(0, 300)
    );
    check(
      `${title}: builds without the split`,
      run('loader-split-off', { GT_SPLIT_TRANSLATIONS: 'false' }) === ''
    );
  }
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
  const cdn = await serve(directory, { assets: 'only' });
  const server = await serve(directory, {
    assets: false,
    // Read by src/server.ts when the build's server starts
    env: { CHECK_CDN: cdn.origin },
  });
  for (const locale of ['fr', 'en']) await walk(title, server.origin, locale);
  await server.close();
  await cdn.close();
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
finish();
