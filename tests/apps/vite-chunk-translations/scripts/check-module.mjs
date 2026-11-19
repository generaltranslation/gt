// Checks chunk translations that are split by module
// (experimentalChunkTranslationsSplit: 'module'), as scripts/check.mjs checks
// the split by chunk: builds the app, serves each build as static files and
// drives it in headless Chromium.
//   node scripts/check-module.mjs [variant ...]
// A variant is a build of the app (see VARIANTS); all of them by default.
// Prints one line per check and exits with 1 when any fails.
//
// A file here holds the messages of modules from many chunks, so nothing is
// looked up by a chunk's name: every expectation comes from the manifest
// (which files an import needs) and from what the files hold.
import { spawnSync } from 'node:child_process';
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
const CHECK = join(root, '.check');
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
// CHECK_IMPORT_MAP=true makes every build with Vite's chunk import map
// (`build.chunkImportMap`), by which chunks import each other
const IMPORT_MAP = process.env.CHECK_IMPORT_MAP === 'true';

/**
 * The builds. `lazy` is Rolldown's `strictExecutionOrder`: a module runs when
 * it is first imported, so a page needs only the translations of the modules
 * it reaches. Without it a chunk runs all of its modules, and the build
 * splits as if each read its messages then. `shared` packs the shared
 * modules, which different routes use, into one chunk. The app's files are a
 * few hundred bytes, so at the default request cost all of them merge into
 * the entry's; the shared builds are split at a request cost of zero, which
 * keeps apart what different routes reach.
 */
const VARIANTS = {
  lazy: { lazy: true, shared: false, slow: true },
  eager: { lazy: false, shared: false, slow: true },
  'shared-lazy': { lazy: true, shared: true, requestCost: 0 },
  'shared-eager': { lazy: false, shared: true, requestCost: 0 },
};
const selected = process.argv.slice(2);
const variants = Object.entries(VARIANTS).filter(
  ([name]) => !selected.length || selected.includes(name)
);

// ===== Build and serve ===== //

/** Builds the app into `.check/<name>`. Returns the directory, the time and what the build printed. */
function build(name, { lazy, shared, requestCost }, env = {}) {
  const outDir = join(CHECK, name);
  const start = Date.now();
  const result = spawnSync(
    'pnpm',
    ['exec', 'vite', 'build', '--logLevel', 'error'],
    {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        GT_CHUNK_TRANSLATIONS: 'true',
        GT_CHUNK_TRANSLATIONS_SPLIT: 'module',
        GT_CHUNK_TRANSLATIONS_NAMING: '',
        GT_CHUNK_TRANSLATIONS_PREVIOUS: '',
        GT_CHUNK_TRANSLATIONS_REQUEST_COST:
          requestCost === undefined ? '' : String(requestCost),
        CHECK_GT_LOG: 'debug',
        CHECK_LAZY: String(lazy),
        CHECK_SHARED_CHUNK: String(shared),
        CHECK_OUT_DIR: outDir,
        ...env,
      },
    }
  );
  const output = `${result.stdout}${result.stderr}`;
  if (result.status !== 0) {
    console.error(output);
    throw new Error(`The build of ${name} failed`);
  }
  return { outDir, time: Date.now() - start, output };
}

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
};

// How long the server holds back what follows the startup script of a page
// whose name starts with this
const STREAMED = 'streamed-';
const STREAM_DELAY_MS = 250;

/**
 * Serves a directory as it is: no fallback page, 404 for a missing file. A
 * page asked for as `streamed-<page>` is `<page>` sent in two parts, the
 * second after a pause: up to the end of the startup script, then the rest.
 */
function serve(directory) {
  // The builds served before, with which of their paths the host still has
  const earlier = [];
  const server = createServer((request, response) => {
    const { pathname } = new URL(request.url, 'http://localhost');
    const streamed = pathname.startsWith(`/${STREAMED}`);
    const name = normalize(
      pathname === '/'
        ? '/index.html'
        : streamed
          ? pathname.replace(STREAMED, '')
          : pathname
    );
    const file = [[directory, () => true], ...earlier]
      .filter(([, keeps]) => keeps(pathname))
      .map(([served]) => join(served, name))
      .find((path) => statSync(path, { throwIfNoEntry: false })?.isFile());
    if (!file || !join(directory, name).startsWith(directory)) {
      response.writeHead(404).end('Not found');
      return;
    }
    response.writeHead(200, {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
    });
    if (streamed) {
      const html = readFileSync(file, 'utf8');
      const end = html.indexOf('</script>') + '</script>'.length;
      response.write(html.slice(0, end));
      setTimeout(() => response.end(html.slice(end)), STREAM_DELAY_MS);
      return;
    }
    createReadStream(file).pipe(response);
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({
        url: `http://127.0.0.1:${server.address().port}`,
        /**
         * Serves another build at the same address. A host has the files of
         * that build only, unless `keeps` says which paths of the builds
         * before it still has.
         */
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
  frame: 'Acme workspace',
  title: 'Workspace overview',
  tagline: 'Everything your team needs, in one place.',
  msg: 'Maintenance starts tonight',
  hook: 'Billing moved to a new page',
  footer: 'Acme workspace: All systems operational (Open, Closed)',
};
const STATUSES = 'Order status: Pending, Shipped, Delivered (Managed by Ada)';
const GLOSSARY_TERMS = [
  'Invoice',
  'Receipt',
  'Refund',
  'Shipment',
  'Warehouse',
  'Carrier',
  'Tracking number',
  'Delivery window',
  'Billing address',
  'Shipping address',
  'Payment method',
  'Discount code',
  'Subtotal',
  'Sales tax',
  'Order total',
  'Backorder',
  'Return label',
  'Gift message',
  'Packing slip',
  'Customs form',
  'Restocking fee',
  'Store credit',
];
const GLOSSARY = GLOSSARY_TERMS.join('');
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
    // Of a module that only the route and the panel it opens import
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
  reports: {
    heading: 'Quarterly reports',
    columns: 'Region, Revenue, Growth',
    statuses: STATUSES,
    'glossary-title': 'Glossary of terms',
    badge: 'Beta Shared by every route',
  },
};
const HELP = 'Need a hand?Our team answers within one hour.';
// A panel the Orders route opens with a dynamic import of its own
const DETAILS = 'Order detailsTwo lines in this orderGlossary of terms';
const EVERY_TEXT = Object.values({
  ...SHELL,
  ...ROUTES.home,
  ...ROUTES.orders,
  ...ROUTES.settings,
  ...ROUTES.reports,
}).flat();

// The messages each module reads as it is evaluated (see src/evaluated.d.ts)
const MODULE_READS = {
  app: ['All systems operational', 'Open', 'Closed', 'Acme workspace'],
  reports: ['Quarterly reports', 'Region', 'Revenue', 'Growth'],
  statuses: ['Order status', 'Pending', 'Shipped', 'Delivered', 'Managed by '],
  glossary: ['Glossary of terms'],
};
const REPORTS_MODULES = ['reports', 'statuses', 'glossary'];

// What an element renders, as the messages in it and the text between them.
// A message is its source text, or that and a part of it that is written the
// same in its translation's file, for a message with a plural or a value.
const message = (text, part = text) => ({ text, part });
const ELEMENTS = {
  frame: [message('Acme workspace')],
  title: [message('Workspace overview')],
  msg: [message('Maintenance starts tonight')],
  hook: [message('Billing moved to a new page')],
  footer: [
    message('Acme workspace'),
    ': ',
    message('All systems operational'),
    ' (',
    message('Open'),
    ', ',
    message('Closed'),
    ')',
  ],
  badge: [message('Beta'), ' ', message('Shared by every route')],
  glossary: GLOSSARY_TERMS.map((term) => message(term)),
  statuses: [
    message('Order status'),
    ': ',
    message('Pending'),
    ', ',
    message('Shipped'),
    ', ',
    message('Delivered'),
    ' (',
    message('Managed by Ada', 'Managed by '),
    ')',
  ],
  'glossary-title': [message('Glossary of terms')],
  columns: [
    message('Region'),
    ', ',
    message('Revenue'),
    ', ',
    message('Growth'),
  ],
  'heading home': [message('Welcome home')],
  'heading orders': [message('Recent orders')],
  'heading reports': [message('Quarterly reports')],
  orders: [message('1 order is waiting', ' order is waiting')],
};

/** What scripts/pseudo-translate.mjs made of a source text; the name is a value. */
function translate(locale, text) {
  if (locale === 'fr') return text.toUpperCase().replaceAll('ADA', 'Ada');
  if (locale === 'de') return text.toLowerCase().replaceAll('ada', 'Ada');
  return text;
}

const pick = (value, added) => (Array.isArray(value) ? value[added] : value);

// ===== Checks ===== //

let failed = 0;
let prefix = '';
function check(name, passed, detail = '') {
  if (!passed) failed++;
  console.log(
    `${passed ? 'PASS' : 'FAIL'}  ${prefix}${name}${detail ? `  (${detail})` : ''}`
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
  page.on('console', (entry) => {
    if (entry.type() === 'warning') warnings.push(entry.text());
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
    /** When the page first requested `path`. */
    started: (path) => requests.find((request) => request.path === path)?.time,
    close: () => context.close(),
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
  for (const [element, source] of Object.entries({
    ...SHELL,
    ...ROUTES[route],
  })) {
    const expected = translate(locale, pick(source, added));
    const actual = await app.text(element);
    if (actual !== expected)
      wrong.push(`${element}: "${actual}" != "${expected}"`);
  }
  check(`${name}: exact text on ${route}`, !wrong.length, wrong.join('; '));
}

const isTranslations = ({ path }) => /\.[0-9a-f]{8,}\.json$/.test(path);
const isCatalog = ({ path }) => /\/(fr|de)-[\w-]+\.js$/.test(path);
const translationsOf = (app) =>
  app.requests.filter(isTranslations).map(({ path }) => path);
const sameSet = (actual, expected) =>
  actual.length === expected.length &&
  expected.every((item) => actual.includes(item));

/** Holds back every response to a request for one of `paths` by DELAY_MS. */
const delay =
  (...paths) =>
  async (page) => {
    for (const path of paths) {
      await page.route(`**${path}`, async (route) => {
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
        await route.continue();
      });
    }
  };

/** Whether the app never showed the source of any of `sources`, and warned of nothing. */
async function checkNoSource(name, app, locale, sources = EVERY_TEXT) {
  const shown = await app.shown();
  const flashed = sources.filter(
    (source) => translate(locale, source) !== source && shown.includes(source)
  );
  check(
    `${name}: no source text was ever shown`,
    !flashed.length,
    flashed.join('; ')
  );
  check(`${name}: no warnings`, !app.warnings.length, app.warnings.join(' | '));
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

/** Whether `chunk` had arrived long before `file`, which the check holds back. */
async function checkEarly(name, app, chunk, file) {
  const lead = (await app.arrived(file)) - (await app.arrived(chunk));
  check(
    `${name}: the chunk has arrived long before the translations file`,
    lead > DELAY_MS / 2,
    `${lead.toFixed(0)} ms before it`
  );
}

const read = (directory, page = 'index.html') =>
  new Map(
    [
      page,
      ...readdirSync(join(directory, 'assets')).map((file) => `assets/${file}`),
    ].map((file) => [file, readFileSync(join(directory, file), 'utf8')])
  );
/** What differs between two builds: the files only one has, and those with other content. */
function compare(before, after) {
  const renamed = [...after.keys()].filter((file) => !before.has(file));
  const removed = [...before.keys()].filter((file) => !after.has(file));
  const rewritten = [...after.keys()].filter(
    (file) => before.has(file) && before.get(file) !== after.get(file)
  );
  return { renamed, removed, rewritten };
}
const gzip = (file) => gzipSync(readFileSync(file), { level: 9 }).length;
const size = (file) => statSync(file).size;
const total = (files, measure) =>
  files.reduce((sum, file) => sum + measure(file), 0);

const CATALOG = Object.fromEntries(
  ['fr', 'de'].map((locale) => [
    locale,
    JSON.parse(
      readFileSync(join(root, 'src', '_gt', `${locale}.json`), 'utf8')
    ),
  ])
);

/** The hash of the message with a source text, or with a part of one. */
function hashOf(text) {
  const translated = translate('fr', text);
  const entries = Object.entries(CATALOG.fr);
  let found = entries.filter(([, value]) => value === translated);
  if (found.length !== 1) {
    found = entries.filter(([, value]) =>
      JSON.stringify(value).includes(translated)
    );
  }
  if (found.length !== 1) {
    throw new Error(`${found.length} messages match "${text}"`);
  }
  return found[0][0];
}

/** What a build wrote, and where each message and each import's files are. */
function readBuild(outDir) {
  const assets = readdirSync(join(outDir, 'assets'));
  const manifest = JSON.parse(
    readFileSync(join(outDir, 'assets', 'gt-chunk-translations.json'), 'utf8')
  );
  const keyOfHash = new Map();
  for (const [id, hashes] of Object.entries(manifest.assignment.files)) {
    for (const hash of hashes) keyOfHash.set(hash, `assets/gt-${id}`);
  }
  const chunk = (name) =>
    assets.find((file) => file.startsWith(`${name}-`) && file.endsWith('.js'));
  const pathsOf = (keys, locale) =>
    keys.flatMap((key) =>
      manifest.files[key]?.[locale] ? [`/${manifest.files[key][locale]}`] : []
    );
  const [entry] = Object.values(manifest.entries);
  return {
    outDir,
    assets,
    manifest,
    hasChunk: (name) => chunk(name) !== undefined,
    /** The URL of the chunk a module's name is in. */
    chunkOf: (name) => `/assets/${chunk(name)}`,
    /** The files the import of a chunk needs. */
    listOf: (name, locale) =>
      pathsOf(manifest.imports[`assets/${chunk(name)}`] ?? [], locale),
    /** The file that holds a message. */
    fileOf(text, locale) {
      const key = keyOfHash.get(hashOf(text));
      return key
        ? `/${manifest.files[key][locale]}`
        : `/${manifest.unsplit[locale]}`;
    },
    keyOf: (text) => keyOfHash.get(hashOf(text)),
    entryFiles: (locale) => pathsOf(entry.files, locale),
    mapOf: (locale) => `/${manifest.maps[locale]}`,
    unsplitOf: (locale) => `/${manifest.unsplit[locale]}`,
    /** Every file of translations a page of the locale can request. */
    everyFile: (locale) => [
      ...pathsOf(Object.keys(manifest.files), locale),
      `/${manifest.maps[locale]}`,
      `/${manifest.unsplit[locale]}`,
    ],
    /** What a file of translations holds. */
    contentOf: (path) => JSON.parse(readFileSync(join(outDir, path), 'utf8')),
  };
}

/** What an element shows in `locale` when the files `lost` did not load. */
const render = (built, locale, element, lost) =>
  ELEMENTS[element]
    .map((part) =>
      typeof part === 'string'
        ? part
        : lost.includes(built.fileOf(part.part, locale))
          ? part.text
          : translate(locale, part.text)
    )
    .join('');

/**
 * Whether each of `modules` was evaluated once, and only after every file
 * that holds a message it reads then had arrived.
 */
async function checkEvaluation(name, app, built, locale, modules) {
  const evaluated = await app.evaluated();
  const late = [];
  let least = Infinity;
  for (const module of modules) {
    const runs = evaluated[module] ?? [];
    if (runs.length !== 1) late.push(`${module} ran ${runs.length} times`);
    const files = [
      ...new Set(
        MODULE_READS[module].map((text) => built.fileOf(text, locale))
      ),
    ];
    for (const file of files) {
      const margin = runs[0] - (await app.arrived(file));
      if (!(margin >= 0)) late.push(`${module} ran before ${file}`);
      least = Math.min(least, margin);
    }
  }
  check(
    `${name}: ${modules.join(', ')} evaluated once, after the files that hold what ${modules.length > 1 ? 'they read' : 'it reads'}`,
    !late.length,
    late.join('; ') || `the first ${least.toFixed(1)} ms after the last file`
  );
}

/** Visits every route and the dialog, checking text, requests and flashes. */
async function checkLocale(url, locale, built) {
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

  if (built) {
    const { manifest } = built;
    const requested = translationsOf(app);
    const expected =
      locale === manifest.defaultLocale ? [] : built.everyFile(locale);
    check(
      `${locale}: requests exactly its own translation files, once each`,
      sameSet(requested, expected),
      `${requested.length} requested, ${expected.length} expected`
    );
    check(
      `${locale}: never requests the whole catalog`,
      !app.requests.some(isCatalog)
    );
    // The app imports src/versions.ts as it starts, a module without
    // messages: its chunk needs no file, and a page has nothing to say of it
    check(
      `${locale}: imports a chunk without messages, which needs no file, and warns of nothing`,
      app.requests.some(({ path }) => /\/versions-[\w-]+\.js$/.test(path)) &&
        !app.warnings.length,
      app.warnings.join(' | ')
    );

    if (locale !== manifest.defaultLocale) {
      const first = [
        built.mapOf(locale),
        built.unsplitOf(locale),
        ...built.entryFiles(locale),
      ].map(app.started);
      const spread = (Math.max(...first) - Math.min(...first)) * 1000;
      check(
        `${locale}: the map, the entry's files and the unsplit file are requested together`,
        spread >= 0 && spread < 5,
        `${first.length} requests within ${spread.toFixed(1)} ms`
      );

      // The files of each import against the chunk it loads: a file is named
      // by the map, so a chunk imported before the map arrived is requested
      // before its files
      const mapArrived = app.responses.find(
        ({ path }) => path === built.mapOf(locale)
      )?.time;
      const late = [];
      const waiting = [];
      const needed = new Set(built.entryFiles(locale));
      const imported = Object.keys(manifest.imports)
        .map((chunk) => ({ chunk, time: app.started(`/${chunk}`) }))
        .filter(({ time }) => time !== undefined)
        .sort((a, b) => a.time - b.time);
      for (const { chunk, time } of imported) {
        for (const file of pathsOfImport(built, chunk, locale)) {
          const delta = (app.started(file) - time) * 1000;
          if (delta > 0 && !(mapArrived > time)) late.push(file);
          // A file an earlier import or the entry needed was requested then
          if (delta < -TOGETHER_MS && !needed.has(file)) waiting.push(chunk);
          needed.add(file);
        }
      }
      check(
        `${locale}: the files of each dynamic import are requested no later than its chunk`,
        !late.length,
        late.join(', ')
      );
      check(
        `${locale}: no dynamically imported chunk waits for its files before it downloads`,
        !waiting.length,
        waiting.join(', ')
      );
      await checkNoSource(locale, app, locale);
    }
  }
  if (!built || locale === built.manifest.defaultLocale) {
    check(
      `${locale}: no warnings`,
      !app.warnings.length,
      app.warnings.join(' | ')
    );
  }
  const preloads = await app.page.evaluate(() =>
    [...document.querySelectorAll('link[rel="modulepreload"]')].map((link) =>
      new URL(link.href).pathname.replace(/-[\w-]{8}\.js$/, '')
    )
  );
  await app.close();
  return preloads.sort();
}

const pathsOfImport = (built, chunk, locale) =>
  (built.manifest.imports[chunk] ?? []).flatMap((key) =>
    built.manifest.files[key]?.[locale]
      ? [`/${built.manifest.files[key][locale]}`]
      : []
  );

/** Opens `route` in fr with the files `lost` failing as `mode` says, and checks `elements`. */
async function checkFailure(name, built, url, lost, mode, route, elements) {
  const app = await open(url, 'fr', async (page) => {
    for (const path of lost) {
      await page.route(`**${path}`, (request) =>
        mode === 'missing'
          ? request.fulfill({ status: 404, body: 'Not found' })
          : undefined
      );
    }
  });
  const start = Date.now();
  await app.goto();
  if (route !== 'home') await app.navigate(route);
  const elapsed = Date.now() - start;
  const wrong = [];
  for (const element of elements) {
    const expected = render(built, 'fr', element, lost);
    const actual = await app.text(element.split(' ')[0]);
    if (actual !== expected)
      wrong.push(`${element}: "${actual}" != "${expected}"`);
  }
  check(
    `${name}: renders the source text of what failed and the translation of the rest`,
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

// ===== A variant ===== //

const report = [];

async function checkVariant(name, variant) {
  prefix = `[${name}] `;
  const off = build(`module-${name}-off`, variant, {
    GT_CHUNK_TRANSLATIONS: 'false',
  });
  const on = build(`module-${name}`, variant);
  const built = readBuild(on.outDir);
  const { manifest } = built;

  // ----- What the build wrote and said ----- //
  check(
    'the build splits by module and names its files by their content',
    manifest.split === 'module' &&
      Object.keys(manifest.maps).join() === 'fr,de' &&
      Object.keys(manifest.files).every((key) =>
        /^assets\/gt-[0-9a-f]{8,}$/.test(key)
      )
  );
  check(
    'the build replayed every load against the files it wrote',
    on.output.includes(
      'Replayed every entry and import against those files: each holds every message it reads'
    )
  );
  const atStartup =
    /The files every page requests as it starts hold (\d+) messages \(\d+ B\), of which the entries read (\d+) \(\d+ B\)/.exec(
      on.output
    );
  check(
    'the build says how many messages a page requests as it starts, and how many of them its entries read',
    atStartup !== null &&
      Number(atStartup[1]) >= Number(atStartup[2]) &&
      Number(atStartup[1]) ===
        new Set(
          Object.values(manifest.entries).flatMap((entry) =>
            entry.files.flatMap(
              (key) =>
                manifest.assignment.files[key.slice(key.indexOf('gt-') + 3)]
            )
          )
        ).size,
    atStartup?.[0]
  );
  const conservative = /pages load (\d+) messages of modules they never import/;
  // Only a chunk that holds a module one of its imports does not reach makes
  // a page load more than it reaches: the chunk of the shared modules
  const loadsMore = !variant.lazy && variant.shared;
  check(
    variant.lazy
      ? 'a build that runs a module when it is first imported splits by what each import reaches'
      : loadsMore
        ? 'a build that runs every module of a chunk says that it splits for that, and how to split further'
        : 'a build that runs every module of a chunk says nothing when each chunk holds only what its imports reach',
    loadsMore
      ? conservative.test(on.output) &&
          on.output.includes('strictExecutionOrder')
      : !conservative.test(on.output),
    conservative.exec(on.output)?.[0] ?? ''
  );
  check(
    'every file is in the assets directory',
    // The import map is the bundler's, which the page holds a copy of
    readdirSync(on.outDir).sort().join() ===
      (IMPORT_MAP ? 'assets,importmap.json,index.html' : 'assets,index.html')
  );
  check(
    "the app's catalogs are not chunks of the build",
    !built.assets.some((file) => /^(fr|de)-[\w-]+\.js$/.test(file))
  );

  // No message is in two files, and the files hold exactly the messages
  // that a chunk's code can render and no other file holds
  for (const locale of manifest.locales) {
    const counts = new Map();
    for (const files of Object.values(manifest.files)) {
      for (const hash of Object.keys(built.contentOf(`/${files[locale]}`))) {
        counts.set(hash, (counts.get(hash) ?? 0) + 1);
      }
    }
    const unsplit = Object.keys(built.contentOf(built.unsplitOf(locale)));
    const assigned = Object.values(manifest.assignment.files).flat();
    check(
      `${locale}: no message is in two files, and every assigned message is in one`,
      [...counts.values()].every((count) => count === 1) &&
        counts.size === assigned.length &&
        assigned.every((hash) => counts.has(hash)) &&
        !unsplit.some((hash) => counts.has(hash)),
      `${counts.size} messages in ${Object.keys(manifest.files).length} files, ${unsplit.length} unsplit`
    );
  }
  const DEAD = ['never rendered', 'Nobody greets', 'Archived by'];
  const written = built.assets
    .filter((file) => /\.[0-9a-f]{8}\.json$/.test(file))
    .map((file) => readFileSync(join(on.outDir, 'assets', file), 'utf8'))
    .join('\n');
  check(
    'messages of unused code are in the catalog and in no translation file',
    DEAD.every((text) =>
      JSON.stringify(CATALOG.fr).includes(text.toUpperCase())
    ) &&
      !DEAD.some((text) =>
        written.toLowerCase().includes(text.toLowerCase())
      ) &&
      written.includes('WELCOME HOME')
  );

  // A t template is a call that passes its precomputed message, unless
  // CHECK_PRECOMPUTE=false keeps the template. Either way its translation
  // is in a file of the split, also when it has a value.
  const precomputed = process.env.CHECK_PRECOMPUTE !== 'false';
  const homeChunk = built.assets.find((file) => /^Home-[\w-]+\.js$/.test(file));
  check(
    `t templates are ${precomputed ? 'calls with a precomputed message' : 'tagged templates'}`,
    readFileSync(join(on.outDir, 'assets', homeChunk), 'utf8').includes(
      '$_tree:'
    ) === precomputed
  );
  {
    const split = Object.values(manifest.files)
      .map((files) => JSON.stringify(built.contentOf(`/${files.fr}`)))
      .join('\n');
    check(
      'messages with values are in the files of the split, and the unsplit file holds only the msg',
      split.includes('"HELLO, "') &&
        split.includes('"MANAGED BY "') &&
        Object.values(built.contentOf(built.unsplitOf('fr')))
          .sort()
          .join() === 'MAINTENANCE STARTS TONIGHT'
    );
  }

  // ----- Text, requests and flashes ----- //
  const served = await serve(on.outDir);
  const servedOff = await serve(off.outDir);
  const { url } = served;
  const preloads = {};
  for (const locale of ['en', 'fr', 'de'])
    preloads[locale] = await checkLocale(url, locale, built);
  preloads.off = await checkLocale(servedOff.url, 'en');
  check(
    'en: the page preloads the same chunks with and without the option',
    preloads.en.join() === preloads.off.join(),
    `${preloads.en.length} with, ${preloads.off.length} without`
  );

  // ----- The source locale ----- //
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
      times.on.push(await time(url));
      times.off.push(await time(servedOff.url));
    }
    const median = (values) => values.sort((a, b) => a - b)[values.length >> 1];
    check(
      'en: a route loads as fast with the option as without it',
      median(times.on) - median(times.off) < SOURCE_SLACK_MS,
      `median of ${SOURCE_LOADS} loads: ${median(times.on).toFixed(1)} ms with, ${median(times.off).toFixed(1)} ms without`
    );
  }
  const startup = {};
  for (const [which, address] of [
    ['on', url],
    ['off', servedOff.url],
  ]) {
    const app = await open(address, 'en');
    await app.goto();
    startup[which] = app.requests
      .map(({ path }) => path)
      .filter((path) => path.endsWith('.js'));
    await app.close();
  }

  // ----- Modules that read translations as they are evaluated ----- //
  // The Reports route and the two shared modules it imports keep what they
  // read as they are evaluated. Its button imports it twice: once when the
  // pointer reaches it, once when the route renders. Each file its import
  // needs is held back in turn.
  for (const locale of ['fr', 'de']) {
    const files = built.listOf('Reports', locale);
    for (const slow of [undefined, ...files]) {
      const label = `${locale}: a route that reads translations as it is evaluated${slow ? `, ${slow.split('/').pop()} held back` : ''}`;
      const app = await open(url, locale, slow && delay(slow));
      await app.goto();
      const before = app.requests.length;
      await app.navigate('reports');
      await checkRoute(app, locale, 'reports', 0, label);
      const requested = app.requests.slice(before).map(({ path }) => path);
      const chunks = requested.filter((path) => path.endsWith('.js'));
      const fetched = requested.filter((path) => files.includes(path));
      if (fetched.length) {
        const wait =
          (Math.max(...chunks.map(app.started)) -
            Math.min(...fetched.map(app.started))) *
          1000;
        check(
          `${label}: its chunks start downloading with its translation files`,
          wait < TOGETHER_MS,
          `the last of ${chunks.length} chunks ${wait.toFixed(1)} ms after the first of ${fetched.length} files`
        );
      }
      checkOnce(label, app, [...chunks, ...files]);
      if (slow && fetched.includes(slow)) {
        await checkEarly(label, app, built.chunkOf('Reports'), slow);
      }
      await checkEvaluation(label, app, built, locale, REPORTS_MODULES);
      await checkNoSource(label, app, locale);
      await app.close();
    }
  }

  // ----- The application root ----- //
  // The entry imports it once gt-react has started. It reads its own
  // messages and one of the entry's as its module is evaluated.
  for (const slow of built.listOf('App', 'fr')) {
    const label = `the application root, ${slow.split('/').pop()} held back`;
    const app = await open(url, 'fr', delay(slow));
    await app.goto();
    await checkRoute(app, 'fr', 'home', 0, label);
    if (!built.entryFiles('fr').includes(slow)) {
      await checkEarly(label, app, built.chunkOf('App'), slow);
    }
    await checkEvaluation(label, app, built, 'fr', ['app']);
    await checkNoSource(label, app, 'fr');
    await app.close();
  }
  {
    // No file of an import can be named before the map has arrived
    const label = 'a route opened directly, the map held back';
    const app = await open(url, 'fr', delay(built.mapOf('fr')));
    await app.goto('#reports');
    await checkRoute(app, 'fr', 'reports', 0, label);
    await checkEarly(label, app, built.chunkOf('App'), built.mapOf('fr'));
    const mapArrived = await app.arrived(built.mapOf('fr'));
    const evaluated = await app.evaluated();
    check(
      `${label}: no module of an import is evaluated before the map has arrived`,
      ['app', ...REPORTS_MODULES].every(
        (module) => evaluated[module]?.[0] >= mapArrived
      )
    );
    await checkEvaluation(label, app, built, 'fr', ['app', ...REPORTS_MODULES]);
    await checkNoSource(label, app, 'fr');
    await app.close();
  }
  {
    const app = await open(url, 'fr');
    await app.goto('#settings');
    await checkRoute(app, 'fr', 'settings', 0, 'fr, opened directly');
    await app.close();
  }

  // ----- A page that preloads the chunks of its route ----- //
  // As a server writes it: the build's page with a modulepreload link for
  // the chunk of the root above the startup script, and one for each chunk
  // of the route below it.
  {
    const link = (chunk) =>
      `<link rel="modulepreload" crossorigin href="${built.chunkOf(chunk)}">`;
    const shared = ['shared', 'Glossary', 'Badge', 'statuses'].filter(
      built.hasChunk
    );
    // A page cannot preload a module above its import map, which the
    // bundler writes below the startup script: with one, the first links
    // are right below it
    const writePreloaded = (page, above, below) =>
      writeFileSync(
        join(on.outDir, page),
        readFileSync(join(on.outDir, 'index.html'), 'utf8')
          .replace(
            IMPORT_MAP ? /<script type="importmap">.*?<\/script>/s : '<head>',
            (before) => `${before}${above.map(link).join('')}`
          )
          .replace('</head>', `${below.map(link).join('')}</head>`)
      );
    const listed = (...chunks) => [
      ...new Set(chunks.flatMap((chunk) => built.listOf(chunk, 'fr'))),
    ];

    // The entry's files are slow, so nothing can have waited for them
    writePreloaded('preloaded.html', ['App'], ['Orders', ...shared]);
    const entry = built.entryFiles('fr');
    const app = await open(url, 'fr', delay(...entry));
    await app.goto('preloaded.html#orders');
    await checkRoute(app, 'fr', 'orders', 0, 'preloaded');
    const entryArrived = Math.min(
      ...entry.map(
        (path) => app.responses.find((item) => item.path === path)?.time
      )
    );
    const early = listed('App', 'Orders').filter(
      (file) => !entry.includes(file)
    );
    // At the default request cost every file of this small app merges into
    // the entry's, and no other is left to request early
    const isSplit = variant.requestCost === 0;
    const IN_ENTRY = "every message is in the entry's file";
    check(
      "preloaded: the files of the preloaded root and route are requested from the startup script, before the entry's files arrive",
      (early.length > 0 || !isSplit) &&
        early.every((file) => app.started(file) < entryArrived),
      early
        .map(
          (file) =>
            `${((entryArrived - app.started(file)) * 1000).toFixed(0)} ms before`
        )
        .join(', ') || IN_ENTRY
    );
    const expected = [
      ...new Set([...entry, ...listed('App', 'Orders')]),
      built.mapOf('fr'),
      built.unsplitOf('fr'),
    ];
    check(
      'preloaded: each file is requested once, and none for a chunk that no import names',
      sameSet(translationsOf(app), expected),
      translationsOf(app).join(', ')
    );
    await checkNoSource('preloaded', app, 'fr');
    await app.close();

    // The same page, sent so that the map has arrived before the parser
    // reaches the link of the route: the script requests the route's files
    // when the link is added, long before the app imports the route
    {
      const label = 'preloaded, a link the parser reaches after the map';
      const app = await open(url, 'fr', delay(...entry));
      await app.goto(`${STREAMED}preloaded.html#orders`);
      await checkRoute(app, 'fr', 'orders', 0, label);
      const mapArrived = app.responses.find(
        (item) => item.path === built.mapOf('fr')
      )?.time;
      const entryArrived = Math.min(
        ...entry.map(
          (path) => app.responses.find((item) => item.path === path)?.time
        )
      );
      const route = listed('Orders').filter(
        (file) => !listed('App').includes(file) && !entry.includes(file)
      );
      check(
        `${label}: the files of the route are requested once the link is there, before the entry's files arrive`,
        (route.length > 0 || !isSplit) &&
          route.every(
            (file) =>
              app.started(file) > mapArrived + STREAM_DELAY_MS / 2000 &&
              app.started(file) < entryArrived
          ),
        route
          .map(
            (file) =>
              `${((app.started(file) - mapArrived) * 1000).toFixed(0)} ms after the map`
          )
          .join(', ') || IN_ENTRY
      );
      check(
        `${label}: each file is requested once`,
        sameSet(translationsOf(app), expected),
        `${translationsOf(app).length} files`
      );
      await checkNoSource(label, app, 'fr');
      await app.close();
    }

    // A chunk that only other chunks import is the target of no import: a
    // link for it requests nothing
    writePreloaded('preloaded-shared.html', shared, ['App']);
    const home = await open(url, 'fr');
    await home.goto('preloaded-shared.html');
    await checkRoute(home, 'fr', 'home', 0, 'preloaded, a shared chunk');
    check(
      'preloaded, a shared chunk: the page requests the files of its imports and no other',
      sameSet(translationsOf(home), [
        ...new Set([...entry, ...listed('App', 'Home')]),
        built.mapOf('fr'),
        built.unsplitOf('fr'),
      ]),
      `${translationsOf(home).length} files`
    );
    await home.close();

    const source = await open(url, 'en');
    await source.goto('preloaded.html#orders');
    await checkRoute(source, 'en', 'orders', 0, 'preloaded, en');
    check(
      'preloaded: the source locale requests no translation file',
      !source.requests.some(isTranslations)
    );
    await source.close();

    // The chunks of the root and of a route that read translations as they
    // are evaluated: a link downloads each before gt-react runs, and the
    // import that evaluates them still waits for their translations.
    const chunks = ['App', 'Reports', ...shared];
    writePreloaded(
      'preloaded-reports.html',
      chunks.slice(0, 2),
      chunks.slice(2)
    );
    for (const slow of listed('App', 'Reports')) {
      const label = `preloaded, ${slow.split('/').pop()} held back`;
      const app = await open(url, 'fr', delay(slow));
      await app.goto('preloaded-reports.html#reports');
      await checkRoute(app, 'fr', 'reports', 0, label);
      await checkEarly(label, app, built.chunkOf('Reports'), slow);
      await checkEvaluation(label, app, built, 'fr', [
        'app',
        ...REPORTS_MODULES,
      ]);
      checkOnce(label, app, [
        ...chunks.map(built.chunkOf),
        ...listed('App', 'Reports'),
      ]);
      await checkNoSource(label, app, 'fr');
      await app.close();
    }
  }

  // ----- Locale switch ----- //
  {
    const app = await open(url, 'en');
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
    await checkRoute(app, 'fr', 'home', 0, 'after the switch');
    const locales = new Set(
      translationsOf(app).map((path) => path.split('.').at(-3))
    );
    check(
      'after the switch only the new locale was requested',
      [...locales].join() === 'fr'
    );
    await app.close();
  }

  // ----- Failures ----- //
  // What the lost files held renders its source, everything else its
  // translation: a file is lost alone, whatever else the page needs.
  {
    const entry = built.entryFiles('fr');
    const failures = [
      [
        'the file of a route',
        [built.fileOf('Recent orders', 'fr')],
        'orders',
        ['title', 'footer', 'heading orders', 'orders', 'badge', 'glossary'],
      ],
      [
        'the file of a route that reads translations as it is evaluated',
        [built.fileOf('Quarterly reports', 'fr')],
        'reports',
        ['title', 'heading reports', 'columns', 'statuses', 'glossary-title'],
      ],
      [
        "the entry's files",
        entry,
        'home',
        ['frame', 'title', 'footer', 'heading home', 'msg'],
      ],
      [
        'the unsplit file',
        [built.unsplitOf('fr')],
        'home',
        ['title', 'heading home', 'msg', 'hook'],
      ],
    ];
    for (const mode of variant.slow ? ['missing', 'hanging'] : ['missing']) {
      for (const [what, lost, route, elements] of failures) {
        await checkFailure(
          `${what}, ${mode}`,
          built,
          url,
          lost,
          mode,
          route,
          elements
        );
      }
      // Without the map no import can name its files: only the entry's
      // files and the unsplit file, which the page holds the names of, load
      const app = await open(url, 'fr', (page) =>
        page.route(`**${built.mapOf('fr')}`, (request) =>
          mode === 'missing'
            ? request.fulfill({ status: 404, body: 'Not found' })
            : undefined
        )
      );
      const start = Date.now();
      await app.goto();
      await app.navigate('orders');
      const elapsed = Date.now() - start;
      const lost = built
        .everyFile('fr')
        .filter(
          (file) => !entry.includes(file) && file !== built.unsplitOf('fr')
        );
      const wrong = [];
      for (const element of [
        'frame',
        'title',
        'footer',
        'heading orders',
        'glossary',
        'msg',
      ]) {
        const expected = render(built, 'fr', element, lost);
        const actual = await app.text(element.split(' ')[0]);
        if (actual !== expected)
          wrong.push(`${element}: "${actual}" != "${expected}"`);
      }
      check(
        `the map, ${mode}: renders the source text of every import, and the translations of the entry's files and the unsplit file`,
        !wrong.length,
        wrong.join('; ')
      );
      check(
        `the map, ${mode}: warns and does not hang`,
        app.warnings.some((warning) =>
          warning.includes(
            mode === 'missing'
              ? 'Could not load the translations'
              : 'did not load within'
          )
        ) &&
          (mode === 'missing'
            ? elapsed < 3000
            : elapsed > TIMEOUT_MS - 500 && elapsed < TIMEOUT_MS + 4000),
        `${elapsed} ms`
      );
      await app.close();
    }
  }
  served.close();
  servedOff.close();

  // ----- A relative base ----- //
  // The page is in a directory: the map and every file it lists are found
  // from the build's assets, also once the app has changed the page's URL.
  // Not with an import map: Vite writes its names relative to the page,
  // where no chunk is, so such a page does not load with or without chunk
  // translations.
  if (!IMPORT_MAP) {
    const relative = await serve(
      build(`module-${name}-relative`, variant, {
        CHECK_ENTRY: 'pages/nested.html',
        CHECK_BASE: './',
      }).outDir
    );
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
      app.requests.some(({ path }) => /\/versions-[\w-]+\.js$/.test(path)) &&
        !app.warnings.length,
      app.warnings.join(' | ')
    );
    const requested = translationsOf(app);
    check(
      "a relative base: every translation file is requested from the build's assets, and none fails",
      requested.length > 0 &&
        requested.every((path) => path.startsWith('/assets/')) &&
        !app.warnings.length,
      [...requested, ...app.warnings].join(', ')
    );
    await app.close();
    relative.close();
  }

  // ----- What a route downloads ----- //
  // The translations a page has downloaded when it shows the Home route,
  // against what Home can reach: the entry, the root, the route and the
  // badge. The glossary and the statuses are in the same chunk as the badge
  // in a build with `shared`, and Home imports neither.
  const UNREACHED = [
    ...GLOSSARY_TERMS,
    'Glossary of terms',
    'Order status',
    'Managed by ',
  ];
  const downloadOfHome = async (outDir) => {
    const server = await serve(outDir);
    const app = await open(server.url, 'fr');
    await app.goto();
    const files = translationsOf(app).filter(
      (path) => !/\/gt-(map|unsplit)\./.test(path)
    );
    const held = files
      .map((path) => readFileSync(join(outDir, path), 'utf8'))
      .join('\n');
    const result = {
      files: files.length,
      bytes: total(
        files.map((path) => join(outDir, path)),
        gzip
      ),
      unreached: UNREACHED.filter((text) =>
        held.includes(`"${translate('fr', text)}"`)
      ).length,
    };
    await app.close();
    server.close();
    return result;
  };
  const home = await downloadOfHome(on.outDir);
  let byChunk;
  if (variant.shared) {
    byChunk = await downloadOfHome(
      build(`chunk-${name}`, variant, {
        GT_CHUNK_TRANSLATIONS_SPLIT: 'chunk',
        GT_CHUNK_TRANSLATIONS_NAMING: 'map',
      }).outDir
    );
    check(
      'split by chunk, the Home route downloads the translations of every module in the shared chunk',
      byChunk.unreached === UNREACHED.length,
      `${byChunk.unreached} of ${UNREACHED.length} messages of modules it does not import, ${byChunk.bytes} B gzip in ${byChunk.files} files`
    );
    check(
      variant.lazy
        ? 'split by module, the Home route downloads no translation of a module it cannot reach'
        : 'split by module in a build that runs every module of a chunk, the Home route downloads what the shared modules read as its chunk loads',
      variant.lazy ? home.unreached === 0 : home.unreached === UNREACHED.length,
      `${home.unreached} of ${UNREACHED.length} messages of modules it does not import, ${home.bytes} B gzip in ${home.files} files`
    );
  }

  // ----- What changes between two builds ----- //
  const previous = {
    GT_CHUNK_TRANSLATIONS_PREVIOUS: join(
      on.outDir,
      'assets',
      'gt-chunk-translations.json'
    ),
  };
  const base = read(on.outDir);
  const translationFiles = (files) =>
    files.filter((file) =>
      /\/gt-[0-9a-f]+\.\w+\.[0-9a-f]{8}\.json$/.test(file)
    );
  {
    const same = compare(
      base,
      read(build(`module-${name}-again`, variant, previous).outDir)
    );
    check(
      'built again from its own manifest, the build writes the same files',
      !same.renamed.length && !same.removed.length && !same.rewritten.length,
      [...same.renamed, ...same.rewritten].join(', ')
    );
  }
  const stability = {};
  {
    // One translation of one locale changed: a message of the Orders route
    const translations = join(CHECK, 'module-translations');
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
    const deployed = build(`module-${name}-changed`, variant, {
      ...previous,
      CHECK_TRANSLATIONS: translations,
    }).outDir;
    const changed = compare(base, read(deployed));
    const expected = [
      built.fileOf('Recent orders', 'fr').replace(/\.[0-9a-f]{8}\.json$/, ''),
      '/assets/gt-map.fr',
    ];
    check(
      "a changed translation renames only its file and the locale's map",
      changed.renamed.length === 2 &&
        expected.every((start) =>
          changed.renamed.some((file) => `/${file}`.startsWith(`${start}.`))
        ),
      changed.renamed.join(', ')
    );
    check(
      'a changed translation rewrites only the page, the manifest and the file of current names, and changes no JavaScript',
      changed.rewritten.sort().join() ===
        'assets/gt-chunk-translations.json,assets/gt-current.json,index.html',
      changed.rewritten.join(', ')
    );
    stability.changed = changed.renamed.length;

    // ----- A page that stays open while the app is deployed again ----- //
    // The page is of the first build, and the host then serves the one with
    // the changed translation. On a host that drops the files of earlier
    // builds the file of that message is gone under the name the page has:
    // the page reads the names of the build that is served now, and the
    // lists of its map, and asks for what they list for the route. On a
    // host that keeps them the page goes on with the build it is of. Where
    // the entry's files hold the message, the page has it already and asks
    // for nothing.
    const next = readBuild(deployed);
    const before = built.fileOf(ROUTES.orders.heading, 'fr');
    const now = next.fileOf(ROUTES.orders.heading, 'fr');
    const current = `/${manifest.current}`;
    const held = built.entryFiles('fr').includes(before);
    const visit = async (keeps) => {
      const deploys = await serve(on.outDir);
      const app = await open(deploys.url, 'fr');
      await app.goto();
      await app.page.waitForLoadState('networkidle');
      deploys.deploy(deployed, keeps);
      const start = app.requests.length;
      await app.navigate('orders');
      const asked = app.requests.slice(start).map(({ path }) => path);
      const wrong = [];
      for (const [element, source] of Object.entries({
        ...SHELL,
        ...ROUTES.orders,
      })) {
        const expected =
          element === 'heading' && !keeps && !held
            ? 'RECENT ORDERS, AGAIN'
            : translate('fr', pick(source, 0));
        const actual = await app.text(element);
        if (actual !== expected)
          wrong.push(`${element}: "${actual}" != "${expected}"`);
      }
      return {
        app,
        url: deploys.url,
        asked,
        wrong: wrong.join('; '),
        close: () => Promise.all([app.close(), deploys.close()]),
      };
    };
    const once = (asked, path) =>
      asked.filter((other) => other === path).length === 1;
    check(
      'an open page: the build writes the hash in the name of each map under a name every build has',
      manifest.current === 'assets/gt-current.json' &&
        next.manifest.current === manifest.current &&
        now !== before
    );
    {
      const title =
        'an open page, after a deploy that changed a translation, on a host that drops earlier files';
      const { app, url, asked, wrong, close } = await visit();
      check(
        `${title}: every text of the route is translated, the changed one as the build that is served has it unless the page held it`,
        !wrong,
        wrong
      );
      check(
        `${title}: asks for the file that is gone once, then for the current names, the map they name and what it lists for the route`,
        held
          ? !asked.some((path) => isTranslations({ path }))
          : once(asked, before) &&
              once(asked, current) &&
              once(asked, next.mapOf('fr')) &&
              once(asked, now) &&
              asked.indexOf(before) < asked.indexOf(current) &&
              asked.indexOf(current) < asked.indexOf(next.mapOf('fr')) &&
              asked.indexOf(next.mapOf('fr')) < asked.indexOf(now),
        `${held ? 'the entry holds the message; ' : ''}${asked.filter((path) => path.endsWith('.json')).join(', ')}`
      );
      await checkNoSource(title, app, 'fr', [
        ROUTES.orders.heading,
        ROUTES.orders.lines,
      ]);
      const reopened = await reopenOrders(app.page, url);
      check(
        `${title}: the page loaded again, and a new tab, show the text of the build that is served`,
        reopened.join() === 'RECENT ORDERS, AGAIN,RECENT ORDERS, AGAIN',
        reopened.join(' | ')
      );
      await close();
    }
    {
      const title =
        'an open page, after the same deploy, on a host that keeps earlier files';
      const { app, url, asked, wrong, close } = await visit(() => true);
      check(
        `${title}: every text of the route is translated as the page's own build has it`,
        !wrong,
        wrong
      );
      check(
        `${title}: asks for the files of its own build, finds each, and reads no names`,
        asked
          .filter((path) => isTranslations({ path }))
          .every((path) =>
            statSync(join(on.outDir, path), { throwIfNoEntry: false })
          ) &&
          (held || asked.includes(before)) &&
          !asked.includes(current),
        asked.filter((path) => path.endsWith('.json')).join(', ')
      );
      await checkNoSource(title, app, 'fr', [
        ROUTES.orders.heading,
        ROUTES.orders.lines,
      ]);
      const reopened = await reopenOrders(app.page, url);
      check(
        `${title}: the page loaded again, and a new tab, show the text of the build that is served`,
        reopened.join() === 'RECENT ORDERS, AGAIN,RECENT ORDERS, AGAIN',
        reopened.join(' | ')
      );
      await close();
    }
  }
  {
    // One statement added to a module every route imports: the bundler
    // renames its chunk and every chunk on the way up to the entry. A file
    // is named by the messages it holds and by no chunk, so only the maps,
    // which say what each chunk's import needs, change. With an import map
    // the statement is added to the Home route and renames its chunk alone:
    // the chunks that import it name it as before, so their code must not
    // change.
    const revised = compare(
      base,
      read(
        build(`module-${name}-revision`, variant, { CHECK_REVISION: 'next' })
          .outDir
      )
    );
    const chunks = revised.renamed.filter((file) => file.endsWith('.js'));
    const files = revised.renamed.filter((file) =>
      /\.[0-9a-f]{8}\.json$/.test(file)
    );
    check(
      'a change to JavaScript alone renames chunks, and no translation file but the maps',
      (IMPORT_MAP
        ? chunks.length === 1 &&
          !revised.rewritten.some((file) => file.endsWith('.js'))
        : chunks.length > 1) &&
        sameSet(
          files,
          manifest.locales.map((locale) =>
            files.find((file) => file.startsWith(`assets/gt-map.${locale}.`))
          )
        ),
      `${chunks.length} chunks, ${files.join(', ')}`
    );
    stability.revised = files.length;
    stability.revisedChunks = chunks.length;
  }
  {
    // One more static import: the Home route now reaches the statuses.
    // Their messages are the only ones another set of imports needs.
    const added = readBuild(
      build(`module-${name}-added`, variant, {
        ...previous,
        CHECK_ADD_IMPORT: 'true',
      }).outDir
    );
    const fromNothing = read(
      build(`module-${name}-added-new`, variant, { CHECK_ADD_IMPORT: 'true' })
        .outDir
    );
    const { renamed, removed } = compare(base, read(added.outDir));
    // The files the statuses were in and are in now
    const allowed = [
      ...new Set(
        MODULE_READS.statuses.flatMap((text) => [
          built.keyOf(text),
          added.keyOf(text),
        ])
      ),
    ];
    const touched = translationFiles([...renamed, ...removed]);
    check(
      'one more import renames only files that held or hold a message it newly reaches',
      touched.every((file) =>
        allowed.some((key) => file.startsWith(`${key}.`))
      ),
      `${translationFiles(renamed).length} files renamed: ${translationFiles(renamed).join(', ')}`
    );
    const home = added.listOf('Home', 'fr');
    check(
      'one more import: the route that gained it now needs the file of what it reaches',
      MODULE_READS.statuses.every((text) =>
        home.includes(added.fileOf(text, 'fr'))
      )
    );
    stability.added = translationFiles(renamed).length;
    stability.addedFromNothing = translationFiles(
      compare(base, fromNothing).renamed
    ).length;
  }

  // ----- Numbers ----- //
  const html = (directory) => join(directory, 'index.html');
  const paths = (list, directory) => list.map((path) => join(directory, path));
  const frFiles = Object.values(manifest.files).map((files) => files.fr);
  report.push(
    `
${name}: ${variant.lazy ? 'modules run when first imported' : 'every module of a chunk runs when it loads'}${variant.shared ? ', the shared modules in one chunk' : ''}, request cost ${variant.requestCost ?? 'default'}
  Build: ${off.time} ms without, ${on.time} ms with chunk translations split by module
  Translation files: ${frFiles.length} per locale and a map (${size(join(on.outDir, manifest.maps.fr))} B, ${gzip(join(on.outDir, manifest.maps.fr))} B gzip) for ${built.assets.filter((file) => file.endsWith('.js')).length} chunks
  Messages per fr file: ${frFiles.map((file) => `${file.split('/').pop().split('.')[0]} ${Object.keys(built.contentOf(`/${file}`)).length} (${gzip(join(on.outDir, file))} B gzip)`).join(', ')}
  The Home route downloads ${home.bytes} B gzip of translations in ${home.files} files${byChunk ? `; split by chunk, ${byChunk.bytes} B in ${byChunk.files} files` : ''}
  Startup JavaScript: ${total(paths(startup.off, off.outDir), size)} B (${total(paths(startup.off, off.outDir), gzip)} B gzip) without, ${total(paths(startup.on, on.outDir), size)} B (${total(paths(startup.on, on.outDir), gzip)} B gzip) with
  index.html: ${size(html(off.outDir))} B (${gzip(html(off.outDir))} B gzip) without, ${size(html(on.outDir))} B (${gzip(html(on.outDir))} B gzip) with
  Translation files renamed: ${stability.changed} by a changed translation; ${stability.revised}, the maps, by a change to JavaScript alone that renames ${stability.revisedChunks} chunks; ${stability.added} by one more import with the previous manifest, ${stability.addedFromNothing} without it`
  );
}

for (const [name, variant] of variants) await checkVariant(name, variant);

// ===== An app without dynamic imports or unsplit messages ===== //
// plain.html, built from translations of its one message only: the entry
// holds the one file, and the map lists nothing.
if (!selected.length) {
  prefix = '[plain] ';
  const [hash] = Object.entries(CATALOG.fr).find(
    ([, translation]) => translation === 'ACME WORKSPACE'
  );
  const translations = join(CHECK, 'module-plain-translations');
  mkdirSync(translations, { recursive: true });
  writeFileSync(
    join(translations, 'fr.json'),
    JSON.stringify({ [hash]: 'ACME WORKSPACE' })
  );
  writeFileSync(
    join(translations, 'de.json'),
    JSON.stringify({ [hash]: 'acme workspace' })
  );
  const { outDir } = build('module-plain', VARIANTS.lazy, {
    CHECK_ENTRY: 'plain.html',
    CHECK_TRANSLATIONS: translations,
  });
  const manifest = JSON.parse(
    readFileSync(join(outDir, 'assets', 'gt-chunk-translations.json'), 'utf8')
  );
  const [file] = Object.values(manifest.files);
  check(
    'the build has one file per locale, a map that lists nothing, and no unsplit file',
    Object.keys(manifest.files).length === 1 &&
      !manifest.unsplit &&
      readFileSync(join(outDir, manifest.maps.fr), 'utf8') === '{}'
  );
  const served = await serve(outDir);
  for (const locale of ['en', 'fr', 'de']) {
    const app = await open(served.url, locale);
    await app.page.goto(`${served.url}/plain.html`);
    await app.page.waitForSelector('[data-test="frame"]');
    check(
      `${locale}: exact text`,
      (await app.text('frame')) === translate(locale, SHELL.frame)
    );
    check(
      `${locale}: requests the entry's file and the map, or nothing in the source locale`,
      sameSet(
        translationsOf(app),
        locale === 'en' ? [] : [`/${file[locale]}`, `/${manifest.maps[locale]}`]
      ) && !app.warnings.length,
      [...translationsOf(app), ...app.warnings].join(', ')
    );
    await app.close();
  }
  served.close();
}

// ===== An import the bundler writes with what starts its module ===== //
// start.html, the app started without a top-level await, in a build whose
// modules run in order: the bundler keeps the module that the Orders route
// and its panel share in the route's chunk, and writes the import of the
// route as import(x).then((n) => (n.init(), n.exports)). The route is a load
// like any other: its import asks for the files the map lists for its chunk
// before what starts the module runs. Split at a request cost of zero, so
// that what the route reads is in files the entry does not hold.
if (!selected.length) {
  prefix = '[then] ';
  const built = readBuild(
    build(
      'module-then',
      { lazy: true, shared: false, requestCost: 0 },
      { CHECK_ENTRY: 'start.html' }
    ).outDir
  );
  const imports = built.assets
    .filter((file) => file.endsWith('.js'))
    .map((file) => readFileSync(join(built.outDir, 'assets', file), 'utf8'))
    .join('\n')
    .match(/import\((["'`])\.\/Orders-[\w-]+\.js\1\)\.then\(/g);
  check(
    'the bundler writes the import of the route with what starts its module after it',
    imports?.length === 1,
    imports?.join(', ')
  );
  const file = built.fileOf(ROUTES.orders.heading, 'fr');
  const served = await serve(built.outDir);
  for (const [name, first] of [
    ['opened first', 'orders'],
    ['opened after another route', ''],
  ]) {
    const app = await open(served.url, 'fr');
    await app.goto(`start.html${first && `#${first}`}`);
    if (!first) await app.navigate('orders');
    await checkRoute(app, 'fr', 'orders', 0, `the route ${name}`);
    check(
      `the route ${name}: its import requests a file the entry does not hold, and nothing fails`,
      !built.entryFiles('fr').includes(file) &&
        translationsOf(app).includes(file) &&
        !app.warnings.length,
      [file, ...app.warnings].join(', ')
    );
    await checkNoSource(`the route ${name}`, app, 'fr', [
      ROUTES.orders.heading,
      ROUTES.orders.lines,
    ]);
    await app.close();
  }
  served.close();
}

// ===== An import the bundler writes without an import() ===== //
// The same app as one chunk: a route's module is in the chunk that imports
// it, so the bundler writes the import as Promise.resolve().then(...). It
// loads nothing and nothing can wait there, so the entry's files hold what
// every route reads.
if (!selected.length) {
  prefix = '[one chunk] ';
  const { outDir, output } = build(
    'module-one-chunk',
    { lazy: true, shared: false, requestCost: 0 },
    { CHECK_ENTRY: 'start.html', CHECK_ONE_CHUNK: 'true' }
  );
  const built = readBuild(outDir);
  const chunks = built.assets.filter((file) => file.endsWith('.js'));
  const code = chunks
    .map((file) => readFileSync(join(outDir, 'assets', file), 'utf8'))
    .join('\n');
  check(
    'the build is one chunk, which imports no chunk',
    chunks.length === 1 && !/\bimport\(/.test(code),
    chunks.join(', ')
  );
  check(
    'no import has a list, and the build warns of none',
    !Object.keys(built.manifest.imports).length &&
      !output.includes('Nothing waits for the translations'),
    Object.keys(built.manifest.imports).join(', ')
  );
  const served = await serve(outDir);
  for (const [name, first] of [
    ['opened first', 'orders'],
    ['opened after another route', ''],
  ]) {
    const app = await open(served.url, 'fr');
    await app.goto(`start.html${first && `#${first}`}`);
    if (!first) await app.navigate('orders');
    await checkRoute(app, 'fr', 'orders', 0, `the route ${name}`);
    check(
      `the route ${name}: the entry holds the file of what the route reads`,
      built
        .entryFiles('fr')
        .includes(built.fileOf(ROUTES.orders.heading, 'fr')),
      translationsOf(app).join(', ')
    );
    await checkNoSource(`the route ${name}`, app, 'fr', [
      ROUTES.orders.heading,
      ROUTES.orders.lines,
    ]);
    await app.close();
  }
  served.close();
}
await browser.close();

console.log(report.join('\n'));
if (failed) {
  console.error(`\n${failed} checks failed`);
  process.exit(1);
}
console.log('\nEvery check passed');
