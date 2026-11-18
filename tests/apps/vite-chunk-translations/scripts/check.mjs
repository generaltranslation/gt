// Builds the app with and without chunk translations, serves each build as
// static files and checks the build with them in headless Chromium:
//   node scripts/check.mjs [token|map]
// The argument is how the build names its files
// (experimentalChunkTranslationsNaming); it defaults to `token`.
// Prints one line per check and exits with 1 when any fails.
import { execFileSync } from 'node:child_process';
import {
  createReadStream,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { chromium } from 'playwright-core';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const NAMING = process.argv[2] ?? 'token';
const ON = join(root, '.check', NAMING === 'token' ? 'on' : NAMING);
const OFF = join(root, '.check', 'off');
// CHECK_IMPORT_MAP=true makes every build with Vite's chunk import map
// (`build.chunkImportMap`), by which chunks import each other
const IMPORT_MAP = process.env.CHECK_IMPORT_MAP === 'true';
// gt-react's default; the app waits this long for a file that never arrives
const TIMEOUT_MS = 10_000;
// How long a check holds a translations file back
const DELAY_MS = 400;
// Requests that start together are this close; one that waits for another's
// response is a round trip later
const TOGETHER_MS = 10;
// How much later a route may load in the source locale with the option on,
// between the medians of SOURCE_LOADS loads
const SOURCE_SLACK_MS = 5;
const SOURCE_LOADS = 9;

// ===== Build and serve ===== //

/**
 * `translations` is the directory the build and the app's own loader read
 * the translation files from, when not the app's, `entry` the page to build,
 * when not index.html, `base` Vite's, when not `/`, `revision` a change to
 * the JavaScript of a module every route imports, and `lazy` whether a
 * module runs when it is first imported (Rolldown's strictExecutionOrder).
 */
function build(
  outDir,
  chunkTranslations,
  translations,
  entry,
  base,
  revision,
  lazy
) {
  const start = Date.now();
  execFileSync('pnpm', ['exec', 'vite', 'build', '--logLevel', 'error'], {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production',
      GT_CHUNK_TRANSLATIONS: String(chunkTranslations),
      GT_CHUNK_TRANSLATIONS_NAMING: NAMING,
      CHECK_OUT_DIR: outDir,
      ...(translations && { CHECK_TRANSLATIONS: translations }),
      ...(entry && { CHECK_ENTRY: entry }),
      ...(base && { CHECK_BASE: base }),
      ...(revision && { CHECK_REVISION: revision }),
      ...(lazy && { CHECK_LAZY: 'true' }),
    },
  });
  return Date.now() - start;
}

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
};

// Requests for a translations file that a build does not have. With `token`
// naming the startup script asks a filter which preloaded chunks have a
// file, and the filter says so, rarely, of a chunk that has none: the page
// then requests that file once, next to the chunk, and reads nothing. Which
// chunks those are follows from the names of a build's chunks, so such a
// request is counted and reported, and left out of what the checks compare.
// Any other request for a translations file a build does not have fails.
const filterMisses = new Map();
const absent = [];
// The files a check takes away on purpose, with a deploy
const deployedOver = new Set();
function noteAbsent(directory, pathname) {
  if (deployedOver.has(pathname)) return;
  const chunk = /^(.+)\.[\w-]+\.[0-9a-f]{8}\.json$/.exec(pathname)?.[1];
  if (chunk === undefined) return;
  const hasChunk = statSync(join(directory, normalize(`${chunk}.js`)), {
    throwIfNoEntry: false,
  })?.isFile();
  if (NAMING === 'token' && hasChunk) {
    filterMisses.set(pathname, (filterMisses.get(pathname) ?? 0) + 1);
  } else absent.push(pathname);
}

/** Serves a directory as it is: no fallback page, 404 for a missing file. */
function serve(directory) {
  const server = createServer((request, response) => {
    const { pathname } = new URL(request.url, 'http://localhost');
    const file = join(
      directory,
      normalize(pathname === '/' ? '/index.html' : pathname)
    );
    if (
      !file.startsWith(directory) ||
      !statSync(file, { throwIfNoEntry: false })?.isFile()
    ) {
      noteAbsent(directory, pathname);
      response.writeHead(404).end('Not found');
      return;
    }
    response.writeHead(200, {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
    });
    createReadStream(file).pipe(response);
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({
        url: `http://127.0.0.1:${server.address().port}`,
        close: () => server.close(),
      })
    )
  );
}

/**
 * Serves a build as a static host does that caches hashed assets for good,
 * and deploys another build at the same address. Lists the paths it is
 * asked for, which are those a browser does not have.
 *
 * `deploy(next, keeps)` serves `next`. A host has the files of that build
 * only, unless `keeps` says which paths of the builds before it still has.
 */
function host(directory) {
  const requests = [];
  const earlier = [];
  const server = createServer((request, response) => {
    const { pathname } = new URL(request.url, 'http://localhost');
    const name = normalize(pathname === '/' ? '/index.html' : pathname);
    const file = [[directory, () => true], ...earlier]
      .filter(([, keeps]) => keeps(pathname))
      .map(([served]) => join(served, name))
      .find((path) => statSync(path, { throwIfNoEntry: false })?.isFile());
    if (!file || !join(directory, name).startsWith(directory)) {
      noteAbsent(directory, pathname);
      response.writeHead(404).end('Not found');
      return;
    }
    requests.push(pathname);
    response.writeHead(200, {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': pathname.startsWith('/assets/')
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
    });
    createReadStream(file).pipe(response);
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({
        url: `http://127.0.0.1:${server.address().port}`,
        /** The paths asked for since the last call. */
        asked: () => requests.splice(0),
        deploy(next, keeps) {
          if (keeps) earlier.unshift([directory, keeps]);
          directory = next;
        },
        close: () => server.close(),
      })
    )
  );
}

// ===== What the app renders ===== //

// The source text of each element, with count 1 and after "Add one"
const SHELL = {
  // The entry's own message
  frame: 'Acme workspace',
  title: 'Workspace overview',
  tagline: 'Everything your team needs, in one place.',
  // A msg, which no chunk's file holds
  msg: 'Maintenance starts tonight',
  // A template of the function useGT() returns, in the file of the root's chunk
  hook: 'Billing moved to a new page',
  // What the application root read as its module was evaluated, the first
  // of it from the entry's file
  footer: 'Acme workspace: All systems operational (Open, Closed)',
};
// What a shared module read as it was evaluated
const STATUSES = 'Order status: Pending, Shipped, Delivered (Managed by Ada)';
const GLOSSARY =
  'InvoiceReceiptRefundShipmentWarehouseCarrierTracking numberDelivery windowBilling addressShipping addressPayment methodDiscount codeSubtotalSales taxOrder totalBackorderReturn labelGift messagePacking slipCustoms formRestocking feeStore credit';
const ROUTES = {
  home: {
    heading: 'Welcome home',
    greeting: 'Hello, Ada!',
    files: ['1 file needs review', '2 files need review'],
    role: 'You manage this workspace',
    context: 'Save',
    jsx: 'Read the release notes before you upgrade.',
    'jsx-var': 'Signed in as Ada',
    badge: 'Beta Shared by every route',
  },
  orders: {
    heading: 'Recent orders',
    orders: ['1 order is waiting', '2 orders are waiting'],
    jsx: 'Orders ship within two days.',
    // Of a module in a chunk that the route's chunk and the panel's import
    lines: 'Two lines in this order',
    badge: 'Beta Shared by every route',
    glossary: GLOSSARY,
  },
  settings: {
    heading: 'Account settings',
    access: 'Full access',
    jsx: 'Changes apply to every member at once.',
    statuses: STATUSES,
    badge: 'Beta Shared by every route',
    glossary: GLOSSARY,
  },
  // All but the badge was read as the route's chunks were evaluated
  reports: {
    heading: 'Quarterly reports',
    columns: 'Region, Revenue, Growth',
    statuses: STATUSES,
    'glossary-title': 'Glossary of terms',
    badge: 'Beta Shared by every route',
  },
};
const HELP = 'Need a hand?Our team answers within one hour.';
// A panel the Orders route opens with a dynamic import of its own, which
// renders a module the route renders too
const DETAILS = 'Order detailsTwo lines in this orderGlossary of terms';

/** What scripts/pseudo-translate.mjs made of a source text; the name is a value. */
function translate(locale, text) {
  if (locale === 'fr') return text.toUpperCase().replaceAll('ADA', 'Ada');
  if (locale === 'de') return text.toLowerCase().replaceAll('ada', 'Ada');
  return text;
}

const pick = (value, added) => (Array.isArray(value) ? value[added] : value);

// ===== Checks ===== //

let failed = 0;
function check(name, passed, detail = '') {
  if (!passed) failed++;
  console.log(
    `${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`
  );
}

const browser = await chromium.launch();

/**
 * Opens the app in a new browser context of one locale, recording every
 * request with the time it started, every console warning, and every text
 * the app has shown.
 */
async function open(url, locale, prepare) {
  const context = await browser.newContext({ locale });
  const page = await context.newPage();
  const requests = [];
  const responses = [];
  const warnings = [];
  const session = await context.newCDPSession(page);
  await session.send('Network.enable');
  session.on('Network.requestWillBeSent', ({ request, timestamp }) =>
    requests.push({ path: new URL(request.url).pathname, time: timestamp })
  );
  session.on('Network.responseReceived', ({ response, timestamp }) =>
    responses.push({ path: new URL(response.url).pathname, time: timestamp })
  );
  page.on('console', (message) => {
    if (message.type() === 'warning') warnings.push(message.text());
  });
  await page.addInitScript(() => {
    window.__shown = new Set();
    const record = () => {
      for (const element of document.querySelectorAll('[data-test]')) {
        window.__shown.add(element.textContent);
      }
    };
    new MutationObserver(record).observe(document, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  });
  await prepare?.(page);
  const text = (name) => page.locator(`[data-test="${name}"]`).textContent();
  return {
    page,
    requests,
    responses,
    warnings,
    text,
    shown: () => page.evaluate(() => [...window.__shown]),
    /** When each module that reads translations as it is evaluated ran, in the page's time. */
    evaluated: () => page.evaluate(() => window.__evaluated ?? {}),
    /** When the response to the request for `path` ended, in the same time. */
    arrived: (path) =>
      page.evaluate(
        (path) =>
          performance
            .getEntriesByType('resource')
            .find((entry) => new URL(entry.name).pathname === path)
            ?.responseEnd,
        path
      ),
    close() {
      const paths = requests.map(({ path }) => path);
      const repeated = paths.filter(
        (path, index) => filterMisses.has(path) && paths.indexOf(path) !== index
      );
      if (repeated.length) {
        check(
          'a page requests the file of a chunk the filter is wrong about once',
          false,
          repeated.join(', ')
        );
      }
      return context.close();
    },
    async goto(hash = '') {
      await page.goto(`${url}/${hash}`);
      await page.waitForSelector('[data-route]');
    },
    async navigate(route) {
      await page.click(`[data-nav="${route}"]`);
      await page.waitForSelector(`[data-route="${route}"]`);
    },
  };
}

/**
 * The heading of the Orders route after the page is loaded again, and in a
 * new tab of the same browser: what a visitor sees once the open page is
 * gone, with whatever the first page left in the browser.
 */
async function reopenOrders(page, url) {
  const read = async (opened) => {
    await opened.waitForSelector('[data-route]');
    await opened.click('[data-nav="orders"]');
    await opened.waitForSelector('[data-route="orders"]');
    return opened.locator('[data-test="heading"]').textContent();
  };
  await page.reload();
  const reloaded = await read(page);
  const tab = await page.context().newPage();
  await tab.goto(`${url}/`);
  return [reloaded, await read(tab)];
}

/** Every element of a route, the shell included, against what `locale` renders. */
async function checkRoute(app, locale, route, added, name = locale) {
  const wrong = [];
  for (const [name, source] of Object.entries({ ...SHELL, ...ROUTES[route] })) {
    const expected = translate(locale, pick(source, added));
    const actual = await app.text(name);
    if (actual !== expected)
      wrong.push(`${name}: "${actual}" != "${expected}"`);
  }
  check(`${name}: exact text on ${route}`, !wrong.length, wrong.join('; '));
}

const isTranslationsFile = (path) => /\.[0-9a-f]{8,}\.json$/.test(path);
const isTranslations = ({ path }) =>
  isTranslationsFile(path) && !filterMisses.has(path);
const isCatalog = ({ path }) => /\/(fr|de)-[\w-]+\.js$/.test(path);

// The app imports src/versions.ts as it starts, a module without messages:
// its chunk needs no translation file, and a page has nothing to say of it
const importsPlainChunk = (app) =>
  app.requests.some(({ path }) => /\/versions-[\w-]+\.js$/.test(path));

/** Visits every route and the dialog, checking text, requests and flashes. */
async function checkLocale(url, locale, manifest) {
  const app = await open(url, locale);
  await app.goto();
  await checkRoute(app, locale, 'home', 0);
  await app.page.click('[data-nav="count"]');
  await checkRoute(app, locale, 'home', 1);
  await app.navigate('orders');
  await checkRoute(app, locale, 'orders', 1);
  await app.page.click('[data-nav="details"]');
  await app.page.waitForSelector('[data-test="details"]');
  check(
    `${locale}: exact text in a panel the route imports`,
    (await app.text('details')) === translate(locale, DETAILS)
  );
  await app.navigate('settings');
  await checkRoute(app, locale, 'settings', 1);
  await app.navigate('reports');
  await checkRoute(app, locale, 'reports', 1);
  await app.page.click('[data-nav="help"]');
  await app.page.waitForSelector('[data-test="help"]');
  check(
    `${locale}: exact text in the dialog`,
    (await app.text('help')) === translate(locale, HELP)
  );

  if (manifest) {
    const requested = app.requests
      .filter(isTranslations)
      .map(({ path }) => path.slice(1));
    // Files that hold the same are one file, in a build that names them by their hash
    const expected =
      locale === manifest.defaultLocale
        ? []
        : [
            ...new Set([
              ...Object.values(manifest.entries).map(
                ({ translations }) => translations[locale]
              ),
              ...Object.values(manifest.files).map((files) => files[locale]),
              manifest.unsplit[locale],
              ...(manifest.maps ? [manifest.maps[locale]] : []),
            ]),
          ];
    check(
      `${locale}: requests exactly its own translation files, once each`,
      requested.length === expected.length &&
        expected.every((file) => requested.includes(file)),
      `${requested.length} requested, ${expected.length} expected`
    );
    check(
      `${locale}: never requests the whole catalog`,
      !app.requests.some(isCatalog)
    );
    check(
      `${locale}: imports a chunk without messages, which needs no file, and warns of nothing`,
      importsPlainChunk(app) && !app.warnings.length,
      app.warnings.join(' | ')
    );

    if (locale !== manifest.defaultLocale) {
      const started = (file) =>
        app.requests.find(({ path }) => path === `/${file}`).time;
      const [entry] = Object.values(manifest.entries);
      const unsplitDelay =
        (started(manifest.unsplit[locale]) -
          started(entry.translations[locale])) *
        1000;
      check(
        `${locale}: the unsplit file is requested with the entry's file`,
        unsplitDelay >= 0 && unsplitDelay < 5,
        `${unsplitDelay.toFixed(1)} ms after it`
      );

      // Each other file against the chunk it is of, which the manifest says
      const chunkOfFile = (path) =>
        [
          ...Object.entries(manifest.entries).map(
            ([entry, { translations }]) => [`/${entry}`, translations[locale]]
          ),
          ...Object.entries(manifest.files).map(([key, files]) => [
            `/${key}.js`,
            files[locale],
          ]),
        ].find(
          ([chunk, file]) =>
            `/${file}` === path &&
            app.requests.some((request) => request.path === chunk)
        )[0];
      const late = [];
      const waiting = [];
      const mapArrived = app.responses.find(
        ({ path }) => path === `/${manifest.maps?.[locale]}`
      )?.time;
      for (const { path, time } of app.requests.filter(isTranslations)) {
        if (path === `/${manifest.unsplit[locale]}`) continue;
        if (path === `/${manifest.maps?.[locale]}`) {
          const delay = (time - started(entry.translations[locale])) * 1000;
          check(
            `${locale}: the map is requested with the entry's file`,
            delay >= 0 && delay < 5,
            `${delay.toFixed(1)} ms after it`
          );
          continue;
        }
        const chunk = chunkOfFile(path);
        const loaded = app.requests.find((request) => request.path === chunk);
        const delta = (time - loaded.time) * 1000;
        console.log(
          `      ${path.split('/').pop()} started ${delta.toFixed(1)} ms after its chunk ${chunk.split('/').pop()}`
        );
        if (manifest.entries[chunk.slice(1)]) continue;
        // A file is named by the map, so a chunk imported before the map
        // arrived is requested before its file
        if (delta > 0 && !(mapArrived > loaded.time)) late.push(path);
        if (delta < -TOGETHER_MS) waiting.push(path);
      }
      check(
        `${locale}: each dynamically imported chunk's file is requested no later than the chunk`,
        !late.length,
        late.join(', ')
      );
      check(
        `${locale}: no dynamically imported chunk waits for its file before it downloads`,
        !waiting.length,
        waiting.join(', ')
      );
      const shown = await app.shown();
      const flashed = Object.values({
        ...SHELL,
        ...ROUTES.home,
        ...ROUTES.orders,
        ...ROUTES.settings,
        ...ROUTES.reports,
      })
        .flat()
        .filter(
          (source) =>
            translate(locale, source) !== source && shown.includes(source)
        );
      check(
        `${locale}: no source text was ever shown`,
        !flashed.length,
        flashed.join('; ')
      );
    }
  }
  check(
    `${locale}: no warnings`,
    !app.warnings.length,
    app.warnings.join(' | ')
  );
  const preloads = await app.page.evaluate(() =>
    [...document.querySelectorAll('link[rel="modulepreload"]')].map((link) =>
      new URL(link.href).pathname.replace(/-[\w-]{8}\.js$/, '')
    )
  );
  await app.close();
  return preloads.sort();
}

/** Holds back every response to a request for `path` by DELAY_MS. */
const delay = (path) => (page) =>
  page.route(`**${path}`, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    await route.continue();
  });

/** Whether the app never showed the source of any of `sources`. */
async function checkNoSource(name, app, locale, sources) {
  const shown = await app.shown();
  const flashed = Object.values(sources)
    .flat()
    .filter(
      (source) => translate(locale, source) !== source && shown.includes(source)
    );
  check(
    `${name}: no source text was ever shown`,
    !flashed.length,
    flashed.join('; ')
  );
  check(`${name}: no warnings`, !app.warnings.length, app.warnings.join(' | '));
}

/**
 * Whether each of `modules` (see src/evaluated.d.ts) was evaluated once, and
 * only after every one of `files` had arrived.
 */
async function checkEvaluation(name, app, modules, files) {
  const evaluated = await app.evaluated();
  const arrived = await Promise.all(files.map(app.arrived));
  const runs = modules.map((module) => evaluated[module] ?? []);
  const margin = Math.min(...runs.flat()) - Math.max(...arrived);
  check(
    `${name}: ${modules.join(', ')} evaluated once, after ${files.length > 1 ? 'their translation files' : 'the translations file'} arrived`,
    runs.every((times) => times.length === 1) && margin >= 0,
    `${runs.map((times) => times.length).join(', ')} times, the first ${margin.toFixed(1)} ms after the last of ${files.length} files`
  );
}

/**
 * Whether each of `chunks` started downloading with the first of `files`,
 * and so did not wait for a response to any of them.
 */
function checkTogether(name, app, chunks, files) {
  const started = (path) =>
    app.requests.find((request) => request.path === path)?.time;
  const wait =
    (Math.max(...chunks.map(started)) - Math.min(...files.map(started))) * 1000;
  check(
    `${name}: ${chunks.length > 1 ? 'its chunks start' : 'its chunk starts'} downloading with its translation files`,
    wait < TOGETHER_MS,
    `the last chunk ${wait.toFixed(1)} ms after the first file`
  );
}

/** Whether `chunk` had arrived long before `file`, which the check holds back. */
async function checkEarly(name, app, chunk, file) {
  const lead = (await app.arrived(file)) - (await app.arrived(chunk));
  check(
    `${name}: the chunk has arrived long before the translations file`,
    lead > DELAY_MS / 2,
    `${lead.toFixed(0)} ms before it`
  );
}

/** Whether the page requested each of `paths` exactly once. */
function checkOnce(name, app, paths) {
  const counts = paths.map(
    (path) => app.requests.filter((request) => request.path === path).length
  );
  check(
    `${name}: each chunk and file is requested once`,
    counts.every((count) => count === 1),
    counts.join(', ')
  );
}

// ----- Builds ----- //

const offTime = build(OFF, false);
const onTime = build(ON, true);
const assets = (directory) => readdirSync(join(directory, 'assets'));
const manifest = JSON.parse(
  readFileSync(join(ON, 'assets', 'gt-chunk-translations.json'), 'utf8')
);
/** The file of the chunk of a module, its translations file, the entry's and the map. */
const chunk = (name) =>
  assets(ON).find(
    (file) => file.startsWith(`${name}-`) && file.endsWith('.js')
  );
const chunkOf = (name) => `/assets/${chunk(name)}`;
const fileOf = (name, locale) =>
  `/${manifest.files[`assets/${chunk(name).replace(/\.js$/, '')}`][locale]}`;
const entryOf = (locale) =>
  `/${Object.values(manifest.entries)[0].translations[locale]}`;
const mapOf = (locale) => `/${manifest.maps[locale]}`;

check(
  'off: the build has no translation files, manifest or startup script',
  !assets(OFF).some((file) => file.endsWith('.json')) &&
    !readFileSync(join(OFF, 'index.html'), 'utf8').includes(
      '__GT_CHUNK_TRANSLATIONS__'
    )
);
check(
  "on: the app's catalogs are not chunks of the build, off: they are",
  !assets(ON).some((file) => /^(fr|de)-[\w-]+\.js$/.test(file)) &&
    assets(OFF).filter((file) => /^(fr|de)-[\w-]+\.js$/.test(file)).length === 2
);
check(
  'on: every file is in the assets directory',
  // The import map is the bundler's, which the page holds a copy of
  readdirSync(ON).sort().join() ===
    (IMPORT_MAP ? 'assets,importmap.json,index.html' : 'assets,index.html')
);
if (IMPORT_MAP) {
  // What the bundler wrote: a name for each chunk whose file has a hash,
  // which other chunks import it by and which no file has
  const { imports } = JSON.parse(
    readFileSync(join(ON, 'importmap.json'), 'utf8')
  );
  const page = readFileSync(join(ON, 'index.html'), 'utf8');
  const [name, file] = Object.entries(imports).find(([, file]) =>
    file.startsWith('/assets/Home-')
  );
  const importer = readFileSync(join(ON, 'assets', chunk('App')), 'utf8');
  check(
    'an import map: the page holds it, and chunks import each other by a name that no file has',
    page.includes('<script type="importmap">') &&
      !assets(ON).includes(name.split('/').pop()) &&
      assets(ON).includes(file.split('/').pop()) &&
      importer.includes(`./${name.split('/').pop()}`) &&
      !importer.includes(file.split('/').pop()),
    `${name} is ${file}`
  );
}

// Messages of code the bundler dropped: in the catalogs, in no file
const DEAD = ['never rendered', 'Nobody greets', 'Archived by'];
const catalog = readFileSync(join(root, 'src', '_gt', 'fr.json'), 'utf8');
const written = assets(ON)
  .filter(isTranslationsFile)
  .map((file) => readFileSync(join(ON, 'assets', file), 'utf8'))
  .join('\n');
check(
  'on: messages of unused code are in the catalog and in no translation file',
  DEAD.every((text) => catalog.includes(text.toUpperCase())) &&
    !DEAD.some((text) => written.toLowerCase().includes(text.toLowerCase())) &&
    written.includes('WELCOME HOME')
);

// A t template is a call that passes its precomputed message, unless
// CHECK_PRECOMPUTE=false keeps the template. Either way its translation is
// in the file of its chunk, also when it has a value.
const PRECOMPUTED = process.env.CHECK_PRECOMPUTE !== 'false';
check(
  `on: t templates are ${PRECOMPUTED ? 'calls with a precomputed message' : 'tagged templates'}`,
  readFileSync(join(ON, 'assets', chunk('Home')), 'utf8').includes(
    '$_tree:'
  ) === PRECOMPUTED
);
{
  const unsplit = readFileSync(join(ON, manifest.unsplit.fr), 'utf8');
  const home = readFileSync(join(ON, fileOf('Home', 'fr')), 'utf8');
  const reports = readFileSync(join(ON, fileOf('Reports', 'fr')), 'utf8');
  check(
    'on: messages with values are in the files of their chunks, and the unsplit file holds only the msg',
    home.includes('"HELLO, "') &&
      reports.includes('"MANAGED BY "') &&
      Object.values(JSON.parse(unsplit)).sort().join() ===
        'MAINTENANCE STARTS TONIGHT'
  );
}

// ----- Text, requests and flashes ----- //

const on = await serve(ON);
const off = await serve(OFF);
const preloads = {};
for (const locale of ['en', 'fr', 'de'])
  preloads[locale] = await checkLocale(on.url, locale, manifest);
// Without the option the app loads the catalog, as before
for (const locale of ['en', 'fr'])
  preloads[`${locale} off`] = await checkLocale(off.url, locale);
check(
  'en: the page preloads the same chunks with and without the option',
  preloads.en.join() === preloads['en off'].join(),
  `${preloads.en.length} with, ${preloads['en off'].length} without`
);

// ----- The source locale ----- //
// The same route in both builds: from the click on its button to when its
// chunk is evaluated.
{
  const time = async (url) => {
    const app = await open(url, 'en');
    await app.goto();
    const clicked = await app.page.evaluate(() => {
      const now = performance.now();
      document.querySelector('[data-nav="reports"]').click();
      return now;
    });
    await app.page.waitForSelector('[data-route="reports"]');
    const { reports } = await app.evaluated();
    await app.close();
    return reports[0] - clicked;
  };
  const times = { on: [], off: [] };
  for (let load = 0; load < SOURCE_LOADS; load++) {
    times.on.push(await time(on.url));
    times.off.push(await time(off.url));
  }
  const median = (values) => values.sort((a, b) => a - b)[values.length >> 1];
  check(
    'en: a route loads as fast with the option as without it',
    median(times.on) - median(times.off) < SOURCE_SLACK_MS,
    `median of ${SOURCE_LOADS} loads: ${median(times.on).toFixed(1)} ms with, ${median(times.off).toFixed(1)} ms without`
  );
}

// ----- What a page loads before it shows its first route ----- //
const startup = {};
for (const [name, { url }] of Object.entries({ on, off })) {
  const app = await open(url, 'en');
  await app.goto();
  startup[name] = app.requests
    .map(({ path }) => path)
    .filter((path) => path.endsWith('.js'));
  await app.close();
}

// ----- Modules that read translations as they are evaluated ----- //
// The Reports route and the two shared modules it imports keep what they
// read as they are evaluated. Its button imports it twice: once when the
// pointer reaches it, once when the route renders.
const REPORTS_MODULES = ['reports', 'statuses', 'glossary'];
for (const locale of ['fr', 'de']) {
  const chunks = ['Reports', 'statuses', 'Glossary'].map(chunkOf);
  const files = [fileOf('Reports', locale), fileOf('Glossary', locale)];
  // Nothing held back, then each of the route's files in turn
  for (const slow of [undefined, 'Reports', 'Glossary']) {
    const name = `${locale}: a route that reads translations as it is evaluated${slow ? `, the file of ${slow} held back` : ''}`;
    const app = await open(on.url, locale, slow && delay(fileOf(slow, locale)));
    await app.goto();
    await app.navigate('reports');
    await checkRoute(app, locale, 'reports', 0);
    checkTogether(name, app, chunks, files);
    checkOnce(name, app, [...chunks, ...files]);
    if (slow) {
      await checkEarly(name, app, chunkOf('Reports'), fileOf(slow, locale));
    }
    await checkEvaluation(name, app, REPORTS_MODULES, files);
    await checkNoSource(name, app, locale, { ...SHELL, ...ROUTES.reports });
    await app.close();
  }
}

// ----- The application root ----- //
// The entry imports it once gt-react has started. It reads its own
// messages and one of the entry's as its module is evaluated.
for (const slow of ['index', 'App']) {
  const name = `the application root, the file of ${slow === 'App' ? 'its chunk' : 'the entry'} held back`;
  const files = [entryOf('fr'), fileOf('App', 'fr')];
  const app = await open(
    on.url,
    'fr',
    delay(slow === 'App' ? files[1] : files[0])
  );
  await app.goto();
  await checkRoute(app, 'fr', 'home', 0);
  if (slow === 'App') {
    checkTogether(name, app, [chunkOf('App')], [files[1]]);
    await checkEarly(name, app, chunkOf('App'), files[1]);
  }
  await checkEvaluation(name, app, ['app'], files);
  await checkNoSource(name, app, 'fr', { ...SHELL, ...ROUTES.home });
  await app.close();
}
if (manifest.maps) {
  // No file of a chunk can be named before the map has arrived
  const name = 'a route opened directly, the map held back';
  const app = await open(on.url, 'fr', delay(mapOf('fr')));
  await app.goto('#reports');
  await checkRoute(app, 'fr', 'reports', 0);
  await checkEarly(name, app, chunkOf('App'), mapOf('fr'));
  await checkEvaluation(name, app, ['app'], [mapOf('fr'), fileOf('App', 'fr')]);
  await checkEvaluation(name, app, REPORTS_MODULES, [
    mapOf('fr'),
    fileOf('Reports', 'fr'),
    fileOf('Glossary', 'fr'),
  ]);
  await checkNoSource(name, app, 'fr', { ...SHELL, ...ROUTES.reports });
  await app.close();
}

// ----- A route opened directly ----- //
{
  const app = await open(on.url, 'fr');
  await app.goto('#settings');
  await checkRoute(app, 'fr', 'settings', 0);
  await app.close();
}

// ----- A page that preloads the chunks of its route ----- //
// As a server writes it: the build's page with a modulepreload link for the
// chunk of the root and each chunk of the route, some above the startup
// script and the rest below it.
{
  const preload = (name) =>
    `<link rel="modulepreload" crossorigin href="${chunkOf(name)}">`;
  /**
   * The build's page with a link for each chunk, above and below the startup
   * script. A page cannot preload a module above its import map, which the
   * bundler writes below the startup script: with one, the first links are
   * right below it.
   */
  const writePreloaded = (page, above, below) =>
    writeFileSync(
      join(ON, page),
      readFileSync(join(ON, 'index.html'), 'utf8')
        .replace(
          IMPORT_MAP ? /<script type="importmap">.*?<\/script>/s : '<head>',
          (before) => `${before}${above.map(preload).join('')}`
        )
        .replace('</head>', `${below.map(preload).join('')}</head>`)
    );
  writePreloaded('preloaded.html', ['App', 'Orders'], ['Glossary', 'Badge']);

  // The entry's file is slow, so nothing can have waited for it
  const app = await open(on.url, 'fr', (page) =>
    page.route(`**${entryOf('fr')}`, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 400));
      await route.continue();
    })
  );
  await app.goto('preloaded.html#orders');
  await checkRoute(app, 'fr', 'orders', 0);
  const time = (list, path) => list.find((item) => item.path === path)?.time;
  const entryRequested = time(app.requests, entryOf('fr'));
  const entryArrived = time(app.responses, entryOf('fr'));
  for (const name of ['App', 'Orders', 'Glossary']) {
    const requested = time(app.requests, fileOf(name, 'fr'));
    const delay = (requested - entryRequested) * 1000;
    check(
      `preloaded: the file of ${name} is requested from the startup script, before the entry's file arrives`,
      // With a map, the script requests the file once the map has arrived
      (manifest.maps || delay < 20) && requested < entryArrived,
      `${delay.toFixed(1)} ms after the entry's request, ${((entryArrived - requested) * 1000).toFixed(0)} ms before its response`
    );
  }
  const requested = app.requests.filter(isTranslations).map(({ path }) => path);
  const expected = [
    entryOf('fr'),
    `/${manifest.unsplit.fr}`,
    fileOf('App', 'fr'),
    fileOf('Orders', 'fr'),
    fileOf('Glossary', 'fr'),
    ...(manifest.maps ? [`/${manifest.maps.fr}`] : []),
  ];
  check(
    'preloaded: each file is requested once, and none for a chunk without one',
    requested.length === expected.length &&
      expected.every((file) => requested.includes(file)),
    requested.join(', ')
  );
  const shown = await app.shown();
  const flashed = Object.values({ ...SHELL, ...ROUTES.orders })
    .flat()
    .filter(
      (source) => translate('fr', source) !== source && shown.includes(source)
    );
  check(
    'preloaded: no source text was ever shown',
    !flashed.length,
    flashed.join('; ')
  );
  check(
    'preloaded: no warnings',
    !app.warnings.length,
    app.warnings.join(' | ')
  );
  await app.close();

  const source = await open(on.url, 'en');
  await source.goto('preloaded.html#orders');
  await checkRoute(source, 'en', 'orders', 0);
  check(
    'preloaded: the source locale requests no translation file',
    !source.requests.some(isTranslations)
  );
  await source.close();

  // The chunks of the root and of a route that read translations as they
  // are evaluated: a link downloads each before gt-react runs, and the
  // import that evaluates them still waits for their translations.
  const chunks = ['App', 'Reports', 'Glossary', 'statuses', 'Badge'];
  writePreloaded('preloaded-reports.html', chunks.slice(0, 2), chunks.slice(2));
  for (const slow of ['Reports', 'Glossary', 'App']) {
    const name = `preloaded, the file of ${slow} held back`;
    const app = await open(on.url, 'fr', delay(fileOf(slow, 'fr')));
    await app.goto('preloaded-reports.html#reports');
    await checkRoute(app, 'fr', 'reports', 0);
    await checkEarly(name, app, chunkOf(slow), fileOf(slow, 'fr'));
    await checkEvaluation(
      name,
      app,
      ['app'],
      [entryOf('fr'), fileOf('App', 'fr')]
    );
    await checkEvaluation(name, app, REPORTS_MODULES, [
      fileOf('Reports', 'fr'),
      fileOf('Glossary', 'fr'),
    ]);
    checkOnce(name, app, [
      ...chunks.map(chunkOf),
      ...['App', 'Reports', 'Glossary'].map((file) => fileOf(file, 'fr')),
    ]);
    await checkNoSource(name, app, 'fr', { ...SHELL, ...ROUTES.reports });
    await app.close();
  }
}

// ----- Locale switch ----- //
{
  const app = await open(on.url, 'en');
  await app.goto();
  let loads = 0;
  app.page.on('load', () => loads++);
  await app.page.selectOption('select', 'fr');
  await app.page.waitForFunction(
    () =>
      document.querySelector('[data-test="heading"]')?.textContent ===
      'WELCOME HOME'
  );
  check(
    'switching the locale in the app reloads the page',
    loads === 1,
    `${loads} loads`
  );
  await checkRoute(app, 'fr', 'home', 0);
  const locales = new Set(
    app.requests
      .filter(isTranslations)
      .map(({ path }) => path.split('.').at(-3))
  );
  check(
    'after the switch only the new locale was requested',
    [...locales].join() === 'fr'
  );
  await app.close();
}

// ----- Failures ----- //

/** Opens `route` in fr with the files matching `pattern` failing as `mode` says. */
async function checkFailure(name, pattern, mode, route, expectations) {
  const app = await open(on.url, 'fr', (page) =>
    page.route(pattern, (request) =>
      mode === 'missing'
        ? request.fulfill({ status: 404, body: 'Not found' })
        : undefined
    )
  );
  const start = Date.now();
  await app.goto();
  if (route !== 'home') await app.navigate(route);
  const elapsed = Date.now() - start;
  const wrong = [];
  for (const [element, expected] of Object.entries(expectations)) {
    const actual = await app.text(element);
    if (actual !== expected)
      wrong.push(`${element}: "${actual}" != "${expected}"`);
  }
  check(
    `${name}: renders the source text of what failed`,
    !wrong.length,
    wrong.join('; ')
  );
  const warned = app.warnings.some((warning) =>
    warning.includes(
      mode === 'missing'
        ? 'Could not load the translations'
        : 'did not load within'
    )
  );
  check(`${name}: warns`, warned, app.warnings.join(' | ').slice(0, 200));
  check(
    `${name}: does not hang`,
    mode === 'missing'
      ? elapsed < 3000
      : elapsed > TIMEOUT_MS - 500 && elapsed < TIMEOUT_MS + 4000,
    `${elapsed} ms`
  );
  await app.close();
}

const entryFile = `**${entryOf('fr')}`;
const ordersFile = `**${fileOf('Orders', 'fr')}`;
// The route's own text is the source; the shell and the shared chunk loaded
const ROUTE_FAILED = {
  title: 'WORKSPACE OVERVIEW',
  heading: 'Recent orders',
  orders: '1 order is waiting',
  glossary: GLOSSARY.toUpperCase(),
};
// The entry's file also says which files each import needs, so without it
// every chunk renders the source; the unsplit file needs nothing of it. In a
// build with maps the map says that, so only the entry's own message, which
// the application root also reads, renders the source.
const ENTRY_FAILED = manifest.maps
  ? {
      frame: SHELL.frame,
      title: 'WORKSPACE OVERVIEW',
      footer: `${SHELL.frame}: ALL SYSTEMS OPERATIONAL (OPEN, CLOSED)`,
      heading: 'WELCOME HOME',
      msg: 'MAINTENANCE STARTS TONIGHT',
    }
  : {
      frame: SHELL.frame,
      title: SHELL.title,
      footer: SHELL.footer,
      heading: ROUTES.home.heading,
      msg: 'MAINTENANCE STARTS TONIGHT',
    };
const reportsFile = `**${fileOf('Reports', 'fr')}`;
// What the route's chunks read from its file is the source, the small
// shared chunk's messages included; the larger shared chunk has its own file
const REPORTS_FAILED = {
  title: 'WORKSPACE OVERVIEW',
  heading: ROUTES.reports.heading,
  columns: ROUTES.reports.columns,
  statuses: STATUSES,
  'glossary-title': 'GLOSSARY OF TERMS',
};
const unsplitFile = '**/gt-unsplit.fr.*.json';
// Only the message no chunk's file holds is the source
const UNSPLIT_FAILED = {
  title: 'WORKSPACE OVERVIEW',
  heading: 'WELCOME HOME',
  msg: SHELL.msg,
  hook: 'BILLING MOVED TO A NEW PAGE',
};
await checkFailure(
  'a missing route file',
  ordersFile,
  'missing',
  'orders',
  ROUTE_FAILED
);
await checkFailure(
  'a missing file of a route that reads translations as it is evaluated',
  reportsFile,
  'missing',
  'reports',
  REPORTS_FAILED
);
await checkFailure(
  'a file of such a route that never responds',
  reportsFile,
  'hanging',
  'reports',
  REPORTS_FAILED
);
await checkFailure(
  'a missing entry file',
  entryFile,
  'missing',
  'home',
  ENTRY_FAILED
);
await checkFailure(
  'a route file that never responds',
  ordersFile,
  'hanging',
  'orders',
  ROUTE_FAILED
);
await checkFailure(
  'an entry file that never responds',
  entryFile,
  'hanging',
  'home',
  ENTRY_FAILED
);
await checkFailure(
  'a missing unsplit file',
  unsplitFile,
  'missing',
  'home',
  UNSPLIT_FAILED
);
await checkFailure(
  'an unsplit file that never responds',
  unsplitFile,
  'hanging',
  'home',
  UNSPLIT_FAILED
);
if (manifest.maps) {
  const mapFile = '**/gt-map.fr.*.json';
  // No file of a chunk can be found, the root's included, and no import
  // knows which files it needs; the entry's needs no map
  const MAP_FAILED = {
    frame: 'ACME WORKSPACE',
    title: 'Workspace overview',
    heading: 'Recent orders',
    glossary: GLOSSARY,
  };
  await checkFailure('a missing map', mapFile, 'missing', 'orders', MAP_FAILED);
  await checkFailure(
    'a map that never responds',
    mapFile,
    'hanging',
    'orders',
    MAP_FAILED
  );
}

// A build whose modules run when they are first imported and not when
// their chunk loads (Rolldown's strictExecutionOrder), of start.html, which
// has no top-level await: the bundler then merges chunks. It keeps the
// module that only the Orders route and the panel it opens import in the
// route's chunk, so the panel's chunk imports the route's, and it writes the
// import of the route as import(x).then((n) => (n.init(), n.exports)). The
// build has to read the chunk out of that, and what starts the module must
// still run after its translations. The route is opened first of all, then
// after another route.
{
  const outDir = join(root, '.check', `${NAMING}-lazy`);
  build(outDir, true, undefined, 'start.html', undefined, undefined, true);
  const lazy = await serve(outDir);
  const built = JSON.parse(
    readFileSync(join(outDir, 'assets', 'gt-chunk-translations.json'), 'utf8')
  );
  const imports = readdirSync(join(outDir, 'assets'))
    .filter((file) => file.endsWith('.js'))
    .map((file) => readFileSync(join(outDir, 'assets', file), 'utf8'))
    .join('\n')
    .match(/import\((["'`])\.\/Orders-[\w-]+\.js\1\)\.then\(/g);
  check(
    'modules run in order: the bundler writes the import of the route with what starts its module after it',
    imports?.length === 1,
    imports?.join(', ')
  );
  for (const [name, first] of [
    ['opened first', 'orders'],
    ['opened after another route', ''],
  ]) {
    const app = await open(lazy.url, 'fr');
    await app.goto(`start.html${first && `#${first}`}`);
    if (!first) await checkRoute(app, 'fr', 'home', 0, `modules run in order`);
    if (!first) await app.navigate('orders');
    await checkRoute(app, 'fr', 'orders', 0, `modules run in order, ${name}`);
    await app.page.click('[data-nav="details"]');
    await app.page.waitForSelector('[data-test="details"]');
    check(
      `modules run in order, ${name}: exact text in a panel the route imports`,
      (await app.text('details')) === translate('fr', DETAILS)
    );
    await app.navigate('reports');
    await checkRoute(app, 'fr', 'reports', 0, `modules run in order, ${name}`);
    const requested = app.requests
      .filter(isTranslations)
      .map(({ path }) => path.slice(1));
    const files = Object.values(built.files).map((byLocale) => byLocale.fr);
    check(
      `modules run in order, ${name}: requests only files of the build, each once, and nothing fails`,
      requested.length === new Set(requested).size &&
        requested.every(
          (file) =>
            files.includes(file) ||
            file === built.unsplit.fr ||
            file === built.maps?.fr ||
            Object.values(built.entries).some(
              ({ translations }) => translations.fr === file
            )
        ) &&
        !app.warnings.length,
      [...requested, ...app.warnings].join(', ')
    );
    await checkNoSource(`modules run in order, ${name}`, app, 'fr', [
      ROUTES.orders.heading,
      ROUTES.orders.lines,
      DETAILS,
      ROUTES.reports.heading,
    ]);
    await app.close();
  }
  lazy.close();
}

// A build with a relative base, whose page is in a directory: Vite writes
// the page's own URLs a directory up, and the translation files are there
// too, also once the app has changed the page's URL. Not with an import
// map: Vite writes its names relative to the page, where no chunk is, so
// such a page does not load with or without chunk translations.
if (!IMPORT_MAP) {
  const outDir = join(root, '.check', `${NAMING}-relative`);
  build(outDir, true, undefined, 'pages/nested.html', './');
  const relative = await serve(outDir);
  const app = await open(relative.url, 'fr');
  await app.goto('pages/nested.html');
  await checkRoute(app, 'fr', 'home', 0, 'a relative base, fr');
  await app.page.evaluate(() =>
    window.history.pushState({}, '', '/orders/recent/1')
  );
  await app.navigate('orders');
  await checkRoute(
    app,
    'fr',
    'orders',
    0,
    'a relative base, a changed URL, fr'
  );
  // The bundler names the chunk relative to the importing one here
  check(
    'a relative base: imports a chunk without messages, which needs no file, and warns of nothing',
    importsPlainChunk(app) && !app.warnings.length,
    app.warnings.join(' | ')
  );
  const requested = app.requests.filter(isTranslations);
  check(
    "a relative base: every translation file is requested from the build's assets, and none fails",
    requested.length > 0 &&
      requested.every(({ path }) => path.startsWith('/assets/')) &&
      !app.warnings.length,
    [...requested.map(({ path }) => path), ...app.warnings].join(', ')
  );
  await app.close();
  relative.close();
}

// ===== What a change to JavaScript alone renames ===== //
// The same build with one statement added to a module every route imports.
// The bundler names a chunk by its content and by the names of the chunks it
// imports, so the change renames every chunk on the way up to the entry, and
// no translation changes.
// With an import map the statement is added to the Home route, and renames
// its chunk alone: the chunks that import it name it as before, and so does
// the copy of them a returning visitor holds. What they name it by has to
// find its translation files in the next build too.
// - With one token per locale a file's name follows from its chunk's, so the
//   translation files are renamed with their chunks and a returning visitor
//   requests them again.
// - With maps no file that holds translations is named after a chunk: only
//   the locale's map changes, and a returning visitor requests only that.
const redeploy = await (async () => {
  const changed = join(root, '.check', `${NAMING}-revision`);
  build(changed, true, undefined, undefined, undefined, 'next');
  const [before, after] = [read(ON), read(changed)];
  const { renamed, rewritten } = compare(before, after);
  const chunks = renamed.filter((file) => file.endsWith('.js'));
  const files = renamed.filter(isTranslationsFile);
  const held = new Set(before.values());
  const unchanged = files.filter((file) => held.has(after.get(file)));
  const next = JSON.parse(after.get('assets/gt-chunk-translations.json'));
  if (IMPORT_MAP) {
    check(
      'an import map: a change to JavaScript alone renames the chunk it is in, and the code of no other chunk changes',
      chunks.length === 1 &&
        chunks[0].startsWith('assets/Home-') &&
        !rewritten.some((file) => file.endsWith('.js')),
      [...chunks, ...rewritten].join(', ')
    );
  } else {
    check(
      'a change to JavaScript alone renames the chunks on the way up to the entry',
      ['Badge', 'Home', 'Orders', 'Reports', 'Settings', 'App', 'index'].every(
        (name) => chunks.some((file) => file.startsWith(`assets/${name}-`))
      ),
      `${chunks.length} of ${[...after.keys()].filter((file) => file.endsWith('.js')).length} chunks`
    );
  }
  if (manifest.maps) {
    check(
      'a change to JavaScript alone renames no file that holds translations, only the maps',
      files.sort().join() === Object.values(next.maps).sort().join(),
      files.join(', ')
    );
  } else {
    // Documented for this naming: a renamed chunk renames its file
    const expected = Object.entries(next.files)
      .filter(([key]) => chunks.includes(`${key}.js`))
      .flatMap(([, byLocale]) => Object.values(byLocale));
    check(
      'a change to JavaScript alone renames the translation files of the renamed chunks',
      expected.length > 0 && expected.every((file) => files.includes(file)),
      `${files.length} renamed, ${unchanged.length} of them hold what they held`
    );
  }

  // A visitor who has the first build, at a host that caches assets for good
  const deploys = await host(ON);
  const app = await open(deploys.url, 'fr');
  const visit = async (name) => {
    await app.goto();
    await checkRoute(app, 'fr', 'home', 0, name);
    await app.navigate('orders');
    await checkRoute(app, 'fr', 'orders', 0, name);
    await app.navigate('reports');
    await checkRoute(app, 'fr', 'reports', 0, name);
    await app.page.goto('about:blank');
    return deploys.asked();
  };
  const first = await visit('a first visit, fr');
  deploys.deploy(changed);
  const again = await visit('a visit after only JavaScript changed, fr');
  if (IMPORT_MAP) {
    check(
      'an import map: the chunks a returning visitor holds find the files of the renamed one',
      !app.warnings.length,
      app.warnings.join(' | ')
    );
  }
  await app.close();
  deploys.close();
  const requested = again.filter(isTranslationsFile);
  check(
    'a returning visitor requests the chunks that were renamed, and no other',
    again.filter((path) => path.endsWith('.js')).length > 0 &&
      again
        .filter((path) => path.endsWith('.js'))
        .every((path) => chunks.includes(path.slice(1))),
    again.filter((path) => path.endsWith('.js')).join(', ')
  );
  if (manifest.maps) {
    check(
      'a returning visitor requests no translation file again but the map',
      requested.join() === `/${next.maps.fr}`,
      requested.join(', ')
    );
  } else {
    // Documented for this naming: every file but the unsplit one, whose name
    // holds no chunk's and no token
    const visited = first.filter(isTranslationsFile);
    check(
      'a returning visitor requests the translation files of the renamed chunks again',
      requested.length === visited.length - 1 &&
        !requested.includes(`/${next.unsplit.fr}`),
      `${requested.length} of ${visited.length}`
    );
  }
  const bytes = (paths) =>
    paths.reduce((sum, path) => sum + statSync(join(changed, path)).size, 0);
  return {
    chunks,
    total: [...after.keys()].filter((file) => file.endsWith('.js')).length,
    files,
    unchanged,
    visited: first.filter(isTranslationsFile).length,
    requested,
    bytes: bytes(requested),
  };
})();

// ===== A page that stays open while the app is deployed again ===== //
// A host that has the files of one build only. The build it serves next is
// the same app with one translation changed, of the Orders route in fr, so
// its JavaScript is the same and the files that hold the change have other
// names: one file and the map with maps, every fr file with tokens. A page
// that was open before then asks for a file by the name it had, which is
// gone. It reads the names of the build that is served now from the one
// file every build writes under the same name, and asks once more.
//
// A host that keeps the files of earlier builds has nothing gone: the page
// goes on with the build it is of, and reads no names.
const CHANGED = buildChanged();
{
  const next = JSON.parse(
    readFileSync(join(CHANGED, 'assets', 'gt-chunk-translations.json'), 'utf8')
  );
  const ordersKey = Object.keys(next.files).find((key) =>
    key.startsWith('assets/Orders-')
  );
  const ordersBefore = `/${manifest.files[ordersKey].fr}`;
  const ordersNow = `/${next.files[ordersKey].fr}`;
  const current = `/${manifest.current}`;
  const gone = (path) =>
    isTranslationsFile(path) &&
    !statSync(join(CHANGED, path), { throwIfNoEntry: false });
  for (const file of assets(ON)) {
    if (gone(`/assets/${file}`)) deployedOver.add(`/assets/${file}`);
  }
  check(
    'an open page: the build writes what names its current files under a name every build has',
    manifest.current === 'assets/gt-current.json' &&
      next.current === manifest.current &&
      gone(ordersBefore) &&
      ordersNow !== ordersBefore
  );

  /**
   * Opens Home in fr, deploys `next` when there is one, on a host that
   * keeps the paths of the first build that `keeps` says, and goes to the
   * Orders route. Returns the paths requested after the deploy.
   */
  const visit = async (next, prepare, keeps) => {
    const deploys = await host(ON);
    const app = await open(deploys.url, 'fr', prepare);
    await app.goto();
    await app.page.waitForLoadState('networkidle');
    if (next) deploys.deploy(next, keeps);
    const before = app.requests.length;
    const start = Date.now();
    await app.navigate('orders');
    return {
      app,
      url: deploys.url,
      asked: app.requests.slice(before).map(({ path }) => path),
      elapsed: Date.now() - start,
      close: () => Promise.all([app.close(), deploys.close()]),
    };
  };
  const textOf = async (app, heading) => {
    const wrong = [];
    for (const [element, source] of Object.entries({
      ...SHELL,
      ...ROUTES.orders,
    })) {
      const expected =
        element === 'heading' ? heading : translate('fr', pick(source, 0));
      const actual = await app.text(element);
      if (actual !== expected)
        wrong.push(`${element}: "${actual}" != "${expected}"`);
    }
    return wrong.join('; ');
  };

  {
    const name = 'an open page, after a deploy that changed a translation';
    const { app, url, asked, close } = await visit(CHANGED);
    const wrong = await textOf(app, 'RECENT ORDERS, AGAIN');
    check(
      `${name}: every text of the route is translated, the changed one as the new build has it`,
      !wrong,
      wrong
    );
    const missing = asked.filter(gone);
    const once = (path) => asked.filter((other) => other === path).length === 1;
    check(
      `${name}: asks for each file that is gone once, then for the current names once, then for the file by its new name`,
      missing.includes(ordersBefore) &&
        missing.every(once) &&
        (!manifest.maps || missing.length === 1) &&
        once(current) &&
        once(ordersNow) &&
        asked.indexOf(ordersBefore) < asked.indexOf(current) &&
        asked.indexOf(current) < asked.indexOf(ordersNow) &&
        (!manifest.maps ||
          (once(`/${next.maps.fr}`) &&
            asked.indexOf(current) < asked.indexOf(`/${next.maps.fr}`) &&
            asked.indexOf(`/${next.maps.fr}`) < asked.indexOf(ordersNow))),
      asked.filter((path) => path.endsWith('.json')).join(', ')
    );
    await checkNoSource(name, app, 'fr', { ...SHELL, ...ROUTES.orders });
    const reopened = await reopenOrders(app.page, url);
    check(
      `${name}: the page loaded again, and a new tab, show the text of the build that is served`,
      reopened.join() === 'RECENT ORDERS, AGAIN,RECENT ORDERS, AGAIN',
      reopened.join(' | ')
    );
    await close();
  }

  // What cannot be recovered renders the source of what the file held, says
  // so, and holds nothing up
  const failures = [
    [
      'an open page, when the host has no file of current names',
      CHANGED,
      (page) =>
        page.route(`**${current}*`, (request) =>
          request.fulfill({ status: 404, body: 'Not found' })
        ),
      ordersBefore,
    ],
    [
      'an open page, when the names are those the page has',
      undefined,
      (page) =>
        page.route(`**${ordersBefore}`, (request) =>
          request.fulfill({ status: 404, body: 'Not found' })
        ),
      ordersBefore,
    ],
    [
      'an open page, when the file is gone by its new name too',
      CHANGED,
      (page) =>
        page.route(`**${ordersNow}`, (request) =>
          request.fulfill({ status: 404, body: 'Not found' })
        ),
      ordersNow,
    ],
  ];
  for (const [name, deployed, prepare, warned] of failures) {
    const { app, asked, elapsed, close } = await visit(deployed, prepare);
    const heading = await app.text('heading');
    const title = await app.text('title');
    check(
      `${name}: the route loads with the source text of what the file held, at once`,
      heading === ROUTES.orders.heading &&
        title === translate('fr', SHELL.title) &&
        elapsed < 3000,
      `${heading}, ${title}, ${elapsed} ms`
    );
    check(
      `${name}: warns of the file, and asks for the current names once`,
      app.warnings.some(
        (warning) =>
          warning.includes('Could not load the translations') &&
          warning.includes(warned)
      ) && asked.filter((path) => path === current).length === 1,
      [...app.warnings, ...asked.filter((path) => path === current)]
        .join(' | ')
        .slice(0, 300)
    );
    await close();
  }

  // A host that keeps the files of earlier builds, after the same deploy
  // and after one that changed JavaScript alone, which renamed the chunks:
  // the page asks for the files of its own build and finds them
  for (const [name, deployed] of [
    ['a translation', CHANGED],
    ['JavaScript', join(root, '.check', `${NAMING}-revision`)],
  ]) {
    const title = `an open page, on a host that keeps earlier files, after a deploy that changed ${name}`;
    const { app, url, asked, close } = await visit(
      deployed,
      undefined,
      () => true
    );
    await checkRoute(app, 'fr', 'orders', 0, title);
    const files = asked.filter(isTranslationsFile);
    check(
      `${title}: asks for the files of its own build, finds each, and reads no names`,
      files.includes(ordersBefore) &&
        files.every((path) =>
          statSync(join(ON, path), { throwIfNoEntry: false })
        ) &&
        !asked.includes(current),
      asked.filter((path) => path.endsWith('.json')).join(', ')
    );
    await checkNoSource(title, app, 'fr', { ...SHELL, ...ROUTES.orders });
    const reopened = await reopenOrders(app.page, url);
    const served =
      deployed === CHANGED ? 'RECENT ORDERS, AGAIN' : 'RECENT ORDERS';
    check(
      `${title}: the page loaded again, and a new tab, show the text of the build that is served`,
      reopened.join() === `${served},${served}`,
      reopened.join(' | ')
    );
    await close();
  }

  // A deploy that changed JavaScript and that translation, on a host that
  // keeps the chunks of earlier builds and not their translation files. The
  // page runs the chunks of its own build. The build that is served now
  // assigned messages to files differently, so no file of it stands in for
  // one of the page's: a file that is gone renders the source of its
  // messages, with the warning, and a file that is still there by the name
  // the page has is found.
  {
    const name =
      'an open page, after a deploy that changed JavaScript and a translation';
    const both = join(root, '.check', `${NAMING}-both`);
    build(
      both,
      true,
      join(root, '.check', 'translations'),
      undefined,
      undefined,
      'next'
    );
    const namesOf = (directory) =>
      JSON.parse(
        readFileSync(join(directory, 'assets', 'gt-current.json'), 'utf8')
      );
    check(
      `${name}: that build says it assigned messages to files differently, and the build with only a changed translation that it did not`,
      namesOf(both).c !== namesOf(ON).c && namesOf(CHANGED).c === namesOf(ON).c,
      `${namesOf(ON).c}, ${namesOf(CHANGED).c}, ${namesOf(both).c}`
    );
    const { app, asked, elapsed, close } = await visit(
      both,
      undefined,
      (path) => path.endsWith('.js')
    );
    const texts = {
      heading: await app.text('heading'),
      title: await app.text('title'),
      glossary: await app.text('glossary'),
    };
    const files = asked.filter(isTranslationsFile);
    const lost = files.filter(
      (path) => !statSync(join(both, path), { throwIfNoEntry: false })
    );
    // With maps the glossary's file holds what it held, so it has the name
    // it had; with tokens every file of the locale has another
    check(
      `${name}: the route loads with the source text of the files that are gone, and the translations of the others`,
      texts.heading === ROUTES.orders.heading &&
        texts.title === translate('fr', SHELL.title) &&
        texts.glossary ===
          (manifest.maps ? translate('fr', GLOSSARY) : GLOSSARY) &&
        elapsed < 3000,
      `${texts.heading}, ${texts.title}, ${texts.glossary.slice(0, 20)}, ${elapsed} ms`
    );
    check(
      `${name}: asks for the files of its own build alone, warns of each that is gone, and reads the current names once`,
      files.every((path) =>
        statSync(join(ON, path), { throwIfNoEntry: false })
      ) &&
        lost.includes(ordersBefore) &&
        app.warnings.length === lost.length &&
        lost.every((path) =>
          app.warnings.some((warning) => warning.includes(path))
        ) &&
        asked.filter((path) => path === current).length === 1,
      [...files, ...app.warnings].join(' | ').slice(0, 300)
    );
    await close();
  }
}

await browser.close();
on.close();
off.close();

// ===== What a changed translation renames ===== //
// The same build with one translation of one locale changed: a message of
// the Orders route, in fr. The app's own loadTranslations imports the same
// files the compiler reads, as an app's does.
function read(directory, page = 'index.html') {
  return new Map(
    [page, ...assets(directory).map((file) => `assets/${file}`)].map((file) => [
      file,
      readFileSync(join(directory, file), 'utf8'),
    ])
  );
}
/** What differs between two builds: the files only the second has, and those with other content. */
function compare(before, after) {
  const renamed = [...after.keys()].filter((file) => !before.has(file));
  const rewritten = [...after.keys()].filter(
    (file) => before.has(file) && before.get(file) !== after.get(file)
  );
  return { renamed, rewritten, touched: [...renamed, ...rewritten] };
}
/** Builds the app with that one translation changed. Returns the directory. */
function buildChanged() {
  const translations = join(root, '.check', 'translations');
  mkdirSync(translations, { recursive: true });
  for (const locale of manifest.locales) {
    const catalog = readFileSync(
      join(root, 'src', '_gt', `${locale}.json`),
      'utf8'
    );
    writeFileSync(
      join(translations, `${locale}.json`),
      locale === 'fr'
        ? catalog.replace('"RECENT ORDERS"', '"RECENT ORDERS, AGAIN"')
        : catalog
    );
  }
  const changed = join(root, '.check', `${NAMING}-changed`);
  build(changed, true, translations);
  return changed;
}
const stability = (() => {
  const changed = CHANGED;
  const { renamed, rewritten, touched } = compare(read(ON), read(changed));
  check(
    'a changed translation changes no JavaScript file and no file of another locale',
    !touched.some((file) => file.endsWith('.js') || file.includes('.de.')),
    touched.join(', ')
  );
  if (manifest.maps) {
    const next = JSON.parse(
      readFileSync(
        join(changed, 'assets', 'gt-chunk-translations.json'),
        'utf8'
      )
    );
    const orders = Object.keys(next.files).find((key) =>
      key.startsWith('assets/Orders-')
    );
    check(
      "a changed translation renames only its file and the locale's map",
      renamed.sort().join() ===
        [next.files[orders].fr, next.maps.fr].sort().join(),
      renamed.join(', ')
    );
  }
  check(
    'a changed translation rewrites only the page, the manifest and the file of current names',
    rewritten.sort().join() ===
      'assets/gt-chunk-translations.json,assets/gt-current.json,index.html',
    rewritten.join(', ')
  );
  return { renamed, rewritten };
})();

// The same for an app without unsplit messages: plain.html, built from
// translations of its one message only, before and after that one changes.
{
  const [hash] = Object.entries(
    JSON.parse(readFileSync(join(root, 'src', '_gt', 'fr.json'), 'utf8'))
  ).find(([, translation]) => translation === 'ACME WORKSPACE');
  const builds = ['ACME WORKSPACE', 'ACME WORKSPACE, AGAIN'].map((fr, at) => {
    const translations = join(root, '.check', `plain-translations-${at}`);
    mkdirSync(translations, { recursive: true });
    writeFileSync(
      join(translations, 'fr.json'),
      JSON.stringify({ [hash]: fr })
    );
    writeFileSync(
      join(translations, 'de.json'),
      JSON.stringify({ [hash]: 'acme workspace' })
    );
    const outDir = join(root, '.check', `${NAMING}-plain-${at}`);
    build(outDir, true, translations, 'plain.html');
    return outDir;
  });
  const [before, after] = builds.map((outDir) => read(outDir, 'plain.html'));
  const { renamed, touched } = compare(before, after);
  check(
    'without unsplit messages: the build has no unsplit file and no chunk of a catalog',
    !JSON.parse(before.get('assets/gt-chunk-translations.json')).unsplit &&
      ![...before.keys()].some((file) => /\/(fr|de)-[\w-]+\.js$/.test(file))
  );
  check(
    'without unsplit messages: a changed translation changes no JavaScript file and no file of another locale',
    renamed.length > 0 &&
      !touched.some((file) => file.endsWith('.js') || file.includes('.de.')),
    touched.join(', ')
  );
}

// ===== What the build wrote ===== //

const gzip = (file) => gzipSync(readFileSync(file), { level: 9 }).length;
const size = (file) => statSync(file).size;

// The JavaScript a page in the source locale loads to show its first route:
// the entry, the application root, the route and what they import statically
const total = (files, measure) =>
  files.reduce((sum, file) => sum + measure(file), 0);
const startupOn = startup.on.map((path) => join(ON, path));
const startupOff = startup.off.map((path) => join(OFF, path));
const htmlOn = join(ON, 'index.html');
const htmlOff = join(OFF, 'index.html');

const files = assets(ON).filter(isTranslationsFile);
const mapFile = manifest.maps && join(ON, manifest.maps.fr);
const frFiles = files.filter(
  (file) => file.includes('.fr.') && !file.startsWith('gt-map.')
);
const entryNames = Object.values(manifest.entries).map(({ translations }) =>
  translations.fr.split('/').pop()
);
// What a file is of, which its name does not say in a build with maps
const owners = new Map();
for (const [owner, file] of [
  ...Object.entries(manifest.entries).map(([entry, { translations }]) => [
    entry.replace(/\.js$/, ''),
    translations.fr,
  ]),
  ...Object.entries(manifest.files).map(([key, byLocale]) => [
    key,
    byLocale.fr,
  ]),
]) {
  if (file)
    owners.set(file, [...(owners.get(file) ?? []), owner.split('/').pop()]);
}
const ownerOf = (file) =>
  owners.get(`assets/${file}`)?.join(' + ') ?? file.split('.')[0];
const hashesOf = (file) => {
  const content = JSON.parse(readFileSync(join(ON, 'assets', file), 'utf8'));
  return Object.keys(entryNames.includes(file) ? content.t : content);
};
const uses = new Map();
for (const file of frFiles) {
  for (const hash of hashesOf(file)) uses.set(hash, (uses.get(hash) ?? 0) + 1);
}
const repeated = [...uses.values()].filter((count) => count > 1).length;

check(
  'no page requested a translations file that a build does not have, but for a preloaded chunk the filter is wrong about',
  !absent.length,
  [...new Set(absent)].join(', ')
);

console.log(`
Naming: ${NAMING}${mapFile ? `, the fr map is ${size(mapFile)} B (${gzip(mapFile)} B gzip)` : ''}
A changed fr translation renames ${stability.renamed.length} files: ${stability.renamed.map((file) => file.split('/').pop()).join(', ')}
A change to JavaScript alone renames ${redeploy.chunks.length} of ${redeploy.total} chunks and ${redeploy.files.length} of ${files.length} translation files, ${redeploy.unchanged.length} of which hold what they held
A returning fr visitor requests ${redeploy.requested.length} of ${redeploy.visited} translation files again (${redeploy.bytes} B): ${redeploy.requested.map((path) => path.split('/').pop()).join(', ')}
Build: ${offTime} ms without, ${onTime} ms with chunk translations
Startup JavaScript: ${total(startupOff, size)} B (${total(startupOff, gzip)} B gzip) without, ${total(startupOn, size)} B (${total(startupOn, gzip)} B gzip) with
index.html: ${size(htmlOff)} B (${gzip(htmlOff)} B gzip) without, ${size(htmlOn)} B (${gzip(htmlOn)} B gzip) with
Translation files: ${files.length} for ${manifest.locales.length} locales and ${assets(ON).filter((file) => file.endsWith('.js')).length} chunks
Messages per fr file: ${frFiles.map((file) => `${ownerOf(file)} ${hashesOf(file).length} (${gzip(join(ON, 'assets', file))} B gzip)`).join(', ')}
Messages in more than one fr file: ${repeated} of ${uses.size}
Requests for the file of a preloaded chunk that has none, which the startup script's filter allows: ${[...filterMisses.values()].reduce((sum, count) => sum + count, 0)}${filterMisses.size ? ` (${[...filterMisses.keys()].join(', ')})` : ''}`);

if (failed) {
  console.error(`\n${failed} checks failed`);
  process.exit(1);
}
console.log('\nEvery check passed');
