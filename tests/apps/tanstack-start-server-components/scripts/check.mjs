// Builds the app, whose routes render server components, with and without
// split translations, serves each build and drives it in headless Chromium:
//   node scripts/check.mjs [name...]
// Each name selects the builds whose title holds it; without one, all run.
// Prints one line per check and exits with 1 when any fails.
//
// Every message of the app is in an element with `data-m`, whose `data-src`
// is what the source locale renders. The translation to `fr` is the source in
// upper case, so "right" below means: every such element shows its `data-src`
// in the case of the page's locale, and never showed anything else (see
// scripts/visitor.mjs of tanstack-start-split-translations).
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { serve } from '../../tanstack-start-split-translations/scripts/serve.mjs';
import {
  createOpen,
  createReporter,
} from '../../tanstack-start-split-translations/scripts/visitor.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const only = process.argv.slice(2);

// The routes of the app, and what marks the page of each
const ROUTES = { '/': 'start', '/panel': 'panel', '/card': 'card' };

// What each route with server components shows, by where it is rendered
const SERVER_ROUTES = {
  // renderServerComponent(): the payload names the client component Counter
  '/panel': {
    server: [
      'Posted by the server',
      'Kept on the notice board',
      'There are 4 notices today',
      'Found by its key',
      'Checked by the hook',
      'Pinned for the week',
      'Words from the dictionary',
    ],
    client: ['Pinned by the browser', 'Press to count the notices'],
    count: 10,
  },
  // createCompositeComponent(): the payload names the client component
  // Stamp, and the route's own component fills its two slots
  '/card': {
    server: ['Issued by the server', 'Held by the server'],
    client: [
      'Stamped in the browser',
      'Signed in the browser',
      'Renewed from a slot',
    ],
    count: 5,
  },
};

const SPLITS = {
  off: { GT_SPLIT_TRANSLATIONS: 'false' },
  'chunk, minified ids': {
    GT_SPLIT_TRANSLATIONS: 'true',
    GT_SPLIT_TRANSLATIONS_BY: 'chunk',
    GT_MINIFY_HASHES: 'true',
  },
  // Without a cost per request, or an app this small is one file
  'module, minified ids': {
    GT_SPLIT_TRANSLATIONS: 'true',
    GT_SPLIT_TRANSLATIONS_BY: 'module',
    GT_MINIFY_HASHES: 'true',
    CHECK_REQUEST_COST: '0',
  },
};

const { check, finish } = createReporter();

// ===== Build ===== //

/** Builds the app into .check/<name> with `env`, and returns that directory. */
function build(name, env) {
  const directory = join(root, '.check', name.replace(/[^a-z0-9]+/gi, '-'));
  execFileSync('pnpm', ['exec', 'vite', 'build', '--logLevel', 'error'], {
    cwd: root,
    stdio: ['ignore', 'ignore', 'inherit'],
    env: {
      ...process.env,
      NODE_ENV: 'production',
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
  locale === 'fr' ? source.toUpperCase() : source;

const browser = await chromium.launch();

const open = createOpen({ browser, routes: ROUTES, expected });

/**
 * Reports whether every message of the current page is, and always was,
 * right, and whether the page shows all `count` messages of its route beyond
 * the three of the navigation.
 */
async function checkMessages(title, visitor, count) {
  const { count: shown, wrong } = await visitor.wrong();
  check(
    `${title}: ${shown} messages right, none ever wrong`,
    shown === count + 3 && wrong.length === 0,
    wrong.length ? wrong.slice(0, 4) : `${count + 3} messages expected`
  );
}

/** Reports whether the server components of the page render in `locale`. */
async function checkServerState(title, visitor, route, locale) {
  if (route !== '/panel') return;
  const state = await visitor.page.evaluate(() => ({
    locale: document.querySelector('[data-locale]')?.textContent,
    locales: document.querySelector('[data-locales]')?.textContent,
  }));
  check(
    `${title}: a server component reads the request's locale and the config`,
    state.locale === locale && state.locales === 'en fr',
    state
  );
}

/** Reports whether the client component a payload names is interactive. */
async function checkInteractive(title, visitor, route) {
  if (route !== '/panel') return;
  await visitor.page.click('[data-count]');
  const count = await visitor.page.textContent('[data-count]');
  check(
    `${title}: the client component a payload names is interactive`,
    count === '1',
    count
  );
}

// ===== Each split ===== //

for (const [name, env] of Object.entries(SPLITS)) {
  const title = `server components, split ${name}`;
  if (only.length > 0 && !only.some((selected) => title.includes(selected))) {
    continue;
  }
  const directory = build(title, env);
  const splits = name !== 'off';
  const server = await serve(directory);

  for (const locale of ['fr', 'en']) {
    for (const [route, messages] of Object.entries(SERVER_ROUTES)) {
      const at = `${title}, ${locale}, ${route}`;

      // A first visit
      const visitor = await open(server.origin, locale);
      // Without the comments React writes between the parts of a text
      const html = (await visitor.visit(route)).replaceAll('<!-- -->', '');
      const rendered = [...messages.server, ...messages.client];
      const missing = rendered.filter(
        (source) => !html.includes(`>${expected(source, locale)}<`)
      );
      check(
        `${at}: the server's HTML holds the messages of the server components and of the client components they render`,
        rendered.length > 0 && missing.length === 0,
        missing
      );
      await checkMessages(`${at}: first visit`, visitor, messages.count);
      await checkServerState(`${at}: first visit`, visitor, route, locale);
      // The translations of a client component a payload names are sent
      // with the page, as those of the route's own chunks are. Once the
      // page has hydrated it asks which files an import needs, for the first
      // navigation: the locale's map, or the file of the entry
      const first = visitor.takeTranslationRequests();
      const lists = name.startsWith('module')
        ? /gt-map\.fr\./
        : /index-[^.]+\.fr\./;
      const asks = splits && locale === 'fr';
      check(
        `${at}: a first visit requests no file of translations${asks ? ' but the one that lists the files of each import' : ''}`,
        first.length === (asks ? 1 : 0) &&
          first.every((request) => lists.test(request)),
        first
      );
      await checkInteractive(`${at}: first visit`, visitor, route);

      // A navigation out of the route and back into it: the server
      // components are rendered again, by a server function
      await visitor.navigate('/');
      visitor.takeTranslationRequests();
      await visitor.navigate(route);
      await checkMessages(`${at}: a navigation back`, visitor, messages.count);
      await checkServerState(
        `${at}: a navigation back`,
        visitor,
        route,
        locale
      );
      const again = visitor.takeTranslationRequests();
      check(
        `${at}: a navigation back requests no file of translations`,
        again.length === 0,
        again
      );
      check(
        `${at}: no console error or hydration warning`,
        visitor.problems.length === 0,
        visitor.problems.slice(0, 3)
      );
      await visitor.close();

      // A navigation as the first page of the route in this browser
      const arriving = await open(server.origin, locale);
      await arriving.visit('/');
      arriving.takeTranslationRequests();
      await arriving.navigate(route);
      await checkMessages(
        `${at}: a navigation from another page`,
        arriving,
        messages.count
      );
      await checkServerState(
        `${at}: a navigation from another page`,
        arriving,
        route,
        locale
      );
      const loaded = arriving.takeTranslationRequests();
      check(
        `${at}: that navigation ${splits && locale === 'fr' ? 'gets every file of translations it requests' : 'requests no file of translations'}`,
        loaded.every((request) => request.startsWith('200 ')) &&
          (splits && locale === 'fr') === loaded.length > 0,
        loaded
      );
      await checkInteractive(
        `${at}: a navigation from another page`,
        arriving,
        route
      );
      check(
        `${at}: no console error after that navigation`,
        arriving.problems.length === 0,
        arriving.problems.slice(0, 3)
      );
      await arriving.close();
    }
  }

  // LocaleSelector, rendered by a server component: switching reloads the
  // page, and the server components render in the other locale
  {
    const visitor = await open(server.origin, 'fr');
    await visitor.visit('/panel');
    await visitor.page.locator('select').first().selectOption('en');
    await visitor.page.waitForFunction(
      () => document.documentElement.lang === 'en'
    );
    visitor.setLocale('en');
    await visitor.page.evaluate(() => window.__shown.splice(0));
    await visitor.settle('/panel');
    await checkMessages(
      `${title}: after switching to en with the LocaleSelector of a server component`,
      visitor,
      SERVER_ROUTES['/panel'].count
    );
    await checkServerState(
      `${title}: after switching`,
      visitor,
      '/panel',
      'en'
    );
    check(
      `${title}: no console error through the switch`,
      visitor.problems.length === 0,
      visitor.problems.slice(0, 3)
    );
    await visitor.close();
  }

  // A server process whose first request is a navigation's server function:
  // no router has set GT up when the server components render
  {
    const visitor = await open(server.origin, 'fr');
    await visitor.visit('/');
    await server.deploy(directory);
    await visitor.navigate('/panel');
    await checkMessages(
      `${title}: a navigation that is the first request of a server process`,
      visitor,
      SERVER_ROUTES['/panel'].count
    );
    await checkServerState(
      `${title}: in that server process`,
      visitor,
      '/panel',
      'fr'
    );
    check(
      `${title}: no console error in that navigation`,
      visitor.problems.length === 0,
      visitor.problems.slice(0, 3)
    );
    await visitor.close();
  }

  await server.close();
}

await browser.close();
finish();
