// Measures what a user of one locale loads from a built app, and how long it
// takes to show them a translated page, in headless Chromium.
//   node scripts/load/measure.mjs --dist apps/flat-5k/dist/baseline --locale fr-CA
//     [--n 15]                       page loads per network
//     [--networks 20/50,60/20,150/5] latency ms / throughput Mbps; `none` is unshaped
//     [--label name] [--out file]    default results/load/<app>-<label>-<locale>.json
//     [--preload-landing]            add modulepreload links for the first
//                                    route's chunks to the HTML, as a server
//                                    that knows the route does
//     [--redeploy dist]              also visit the routes again after this
//                                    other build replaced the first one
// A build of scripts/load/generate.mjs describes itself in bench-app.json.
// Any other static build is measured by saying the same with flags:
//     --routes /a,/b,/c              the routes to visit, the first by URL
//     --route-selector '[data-route="{route}"]'   the element a route renders
//     --message-selector li          the elements that hold messages
//     --messages 100,100,100         how many a route holds, when known
//     --translated-text '[áéíóú]'    matches a message in the page's locale;
//                                    leave out for the source locale
//     --translation-files regex      the requests that are translations
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright-core';
import { report } from './report.mjs';
import { GZIP_LEVEL, serve } from './serve.mjs';
import { environment, summarize } from './stats.mjs';
import { NETWORKS, TRANSLATION_FILES } from './variants.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BROTLI_QUALITY = 11;
const NAVIGATION_TIMEOUT_MS = 120_000;
const IDLE_MS = 300;

const { values: args } = parseArgs({
  options: {
    dist: { type: 'string' },
    locale: { type: 'string', default: 'en' },
    n: { type: 'string', default: '15' },
    networks: { type: 'string', default: NETWORKS.join(',') },
    routes: { type: 'string' },
    'route-selector': { type: 'string' },
    'message-selector': { type: 'string' },
    messages: { type: 'string' },
    'translated-text': { type: 'string' },
    'translation-files': { type: 'string', default: TRANSLATION_FILES },
    protocol: { type: 'string', default: 'h2' },
    'preload-landing': { type: 'boolean', default: false },
    redeploy: { type: 'string' },
    cpu: { type: 'string', default: '1' },
    label: { type: 'string' },
    out: { type: 'string' },
  },
});
if (!args.dist) throw new Error('Pass --dist, a built app');
const dist = resolve(args.dist);
const manifestPath = join(dist, 'bench-app.json');
const manifest = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, 'utf8'))
  : {};
const locale = args.locale;
const routes = args.routes?.split(',') ?? manifest.visit;
if (!routes) throw new Error('Pass --routes: the build has no bench-app.json');
const routeSelector =
  args['route-selector'] ??
  manifest.routeSelector ??
  '[data-bench-route="{route}"]';
const messageCounts = args.messages
  ? Object.fromEntries(
      args.messages.split(',').map((count, i) => [routes[i], Number(count)])
    )
  : (manifest.routeMessages ?? {});
const pageConfig = {
  messageSelector: args['message-selector'] ?? manifest.messageSelector ?? 'li',
  // Undefined for the source locale, where every message counts as translated.
  translatedText: args['translated-text'] ?? manifest.translatedText?.[locale],
  landing: expectation(routes[0]),
};
const translationFiles = new RegExp(
  args['translation-files'].replaceAll('{locale}', locale)
);
const label =
  args.label ?? basename(dist) + (args['preload-landing'] ? '-preload' : '');
const samples = Number(args.n);
const cpu = Number(args.cpu);

function expectation(route) {
  return {
    route,
    selector: routeSelector.replaceAll('{route}', route),
    expected: messageCounts[route],
  };
}

const megabits = (value) => (value * 1e6) / 8;
const networks = args.networks.split(',').map((name) => {
  if (name === 'none') return { name };
  const [latency, throughput] = name.split('/').map(Number);
  return {
    name,
    conditions: {
      offline: false,
      latency,
      downloadThroughput: megabits(throughput),
      uploadThroughput: megabits(throughput),
    },
  };
});

// ===== In the page ===== //

/**
 * Runs before the page's scripts. It reads the document after every change:
 * a route is rendered once its element holds its messages, all translated,
 * and a frame that starts while a message shows untranslated text is a flash
 * of the source language.
 */
function observe(config) {
  const translatedText = config.translatedText
    ? new RegExp(config.translatedText)
    : undefined;
  const isTranslated = (text) => !translatedText || translatedText.test(text);
  const state = {
    firstText: null,
    firstTranslated: null,
    firstContentfulPaint: null,
    flashFrames: 0,
    flashedText: null,
    route: null,
  };
  let untranslated = 0;
  let untranslatedSample = null;

  function expect({ route, selector, expected }, start) {
    state.route = {
      route,
      selector,
      expected,
      start,
      rendered: null,
      frame: null,
      messages: 0,
      loaded: null,
    };
  }

  function check() {
    const now = performance.now();
    let texts = 0;
    let translated = 0;
    untranslated = 0;
    for (const message of document.querySelectorAll(config.messageSelector)) {
      const text = message.textContent;
      if (!text.trim()) continue;
      texts++;
      if (isTranslated(text)) translated++;
      else if (untranslated++ === 0) untranslatedSample = text;
    }
    if (texts && state.firstText === null) state.firstText = now;
    if (translated && state.firstTranslated === null) {
      state.firstTranslated = now;
    }
    const route = state.route;
    if (!route || route.rendered !== null) return;
    const element = document.querySelector(route.selector);
    if (!element) return;
    const messages = Array.from(
      element.querySelectorAll(config.messageSelector),
      (message) => message.textContent
    ).filter((text) => text.trim());
    route.messages = messages.length;
    if (
      messages.length > 0 &&
      (route.expected === undefined || messages.length === route.expected) &&
      messages.every(isTranslated)
    ) {
      route.rendered = now - route.start;
      // Every file the page had by the time it rendered the route.
      route.loaded = performance
        .getEntriesByType('resource')
        .map((entry) => new URL(entry.name).pathname);
    }
  }

  function frame() {
    if (untranslated > 0) {
      state.flashFrames++;
      state.flashedText ??= untranslatedSample;
    }
    const route = state.route;
    if (route && route.rendered !== null && route.frame === null) {
      route.frame = performance.now() - route.start;
    }
    window.requestAnimationFrame(frame);
  }

  performance.setResourceTimingBufferSize(10_000);
  expect(config.landing, 0);
  new window.MutationObserver(check).observe(document, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  window.requestAnimationFrame(frame);
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.name === 'first-contentful-paint') {
        state.firstContentfulPaint = entry.startTime;
      }
    }
  }).observe({ type: 'paint', buffered: true });

  window.__loadBench = {
    state,
    /** Goes to a route as a router does, and expects its render. */
    navigate(expectation) {
      expect(expectation, performance.now());
      window.history.pushState({}, '', expectation.route);
      window.dispatchEvent(new window.PopStateEvent('popstate'));
    },
  };
}

// ===== Measure ===== //

const server = await serve(dist, {
  protocol: args.protocol,
  quality: BROTLI_QUALITY,
});
const browser = await chromium.launch({
  args: [`--ignore-certificate-errors-spki-list=${server.spki}`],
});

function categorize(path) {
  if (translationFiles.test(path)) return 'translations';
  if (path.endsWith('.html')) return 'html';
  if (/\.m?js$/.test(path)) return 'js';
  return 'other';
}

/** What the server sent since `mark`, by kind of file. */
function transferred(mark) {
  const totals = Object.fromEntries(
    ['html', 'js', 'translations', 'other', 'total'].map((category) => [
      category,
      { requests: 0, bytes: 0, rawBytes: 0, gzipBytes: 0 },
    ])
  );
  const add = (category, response) => {
    totals[category].requests++;
    totals[category].bytes += response.bytes;
    totals[category].rawBytes += response.rawBytes;
    totals[category].gzipBytes += response.gzipBytes;
  };
  const responses = server.log.slice(mark);
  for (const response of responses) {
    add(categorize(response.path), response);
    add('total', response);
  }
  return {
    ...totals,
    // Requests for files the build does not have, which `requests` counts.
    notFound: responses.filter((response) => response.status === 404).length,
    files: responses.map(({ path, status, bytes }) => ({
      path,
      status,
      bytes,
    })),
  };
}

/**
 * The JavaScript among `paths`, the files a page had when it rendered its
 * first route: what an app's bundle budget counts.
 */
function startupJs(paths) {
  const total = { files: 0, bytes: 0, rawBytes: 0, gzipBytes: 0 };
  for (const path of new Set(paths)) {
    const file = server.files.get(path);
    if (!file || categorize(path) !== 'js') continue;
    total.files++;
    total.bytes += file.body.length;
    total.rawBytes += file.rawBytes;
    total.gzipBytes += file.gzipBytes;
  }
  return total;
}

/** Loads the first route in a new page of `context`, then visits the others. */
async function load(context, network, visit) {
  const tab = await context.newPage();
  const errors = [];
  tab.on('pageerror', (error) => errors.push(String(error)));
  const session = await context.newCDPSession(tab);
  await session.send('Network.enable');
  if (network.conditions) {
    await session.send('Network.emulateNetworkConditions', network.conditions);
  }
  if (cpu > 1) {
    await session.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  }
  let inflight = 0;
  let lastActivity = performance.now();
  const active = new Set();
  session.on('Network.requestWillBeSent', ({ requestId }) => {
    active.add(requestId);
    inflight = active.size;
    lastActivity = performance.now();
  });
  for (const event of ['Network.loadingFinished', 'Network.loadingFailed']) {
    session.on(event, ({ requestId }) => {
      active.delete(requestId);
      inflight = active.size;
      lastActivity = performance.now();
    });
  }
  const idle = async () => {
    while (inflight > 0 || performance.now() - lastActivity < IDLE_MS) {
      await new Promise((done) => setTimeout(done, 25));
    }
  };
  const rendered = async (route) => {
    try {
      await tab.waitForFunction(
        () => window.__loadBench.state.route.frame !== null,
        undefined,
        { timeout: NAVIGATION_TIMEOUT_MS }
      );
    } catch {
      const state = await tab.evaluate(() => window.__loadBench.state);
      throw new Error(
        `${label} (${locale}, ${network.name}): ${route} did not render its ${state.route.expected ?? ''} messages translated. Its element held ${state.route.messages}; untranslated text on the page: ${JSON.stringify(state.flashedText)}; page errors: ${JSON.stringify(errors)}`
      );
    }
    await idle();
    return tab.evaluate(() => window.__loadBench.state);
  };

  const mark = server.log.length;
  await tab.goto(server.origin + visit[0], { waitUntil: 'commit' });
  const landing = await rendered(visit[0]);
  const firstLoad = transferred(mark);
  const navigations = [];
  for (const route of visit.slice(1)) {
    await tab.evaluate(
      (next) => window.__loadBench.navigate(next),
      expectation(route)
    );
    navigations.push((await rendered(route)).route.rendered);
  }
  const state = await tab.evaluate(() => window.__loadBench.state);
  const afterRoutes = transferred(mark);
  await tab.close();
  if (errors.length) {
    throw new Error(`${label} (${locale}): page errors: ${errors.join('; ')}`);
  }
  return {
    rendered: landing.route.rendered,
    frame: landing.route.frame,
    firstText: landing.firstText,
    firstTranslated: landing.firstTranslated,
    firstContentfulPaint: landing.firstContentfulPaint,
    flashFrames: landing.flashFrames,
    flashFramesAfterRoutes: state.flashFrames,
    flashedText: state.flashedText,
    navigations,
    firstLoad,
    afterRoutes,
    startupJs: startupJs(landing.route.loaded),
  };
}

/** A new context has an empty cache and no open connection. */
async function newContext() {
  const context = await browser.newContext({ locale });
  await context.addInitScript(`(${observe})(${JSON.stringify(pageConfig)})`);
  return context;
}
const unshaped = { name: 'none' };

// The chunks the first route loads beyond those the HTML names already,
// preloaded from the HTML.
let preloaded;
if (args['preload-landing']) {
  const context = await newContext();
  const { firstLoad } = await load(context, unshaped, routes.slice(0, 1));
  await context.close();
  const html = server.files.get('/index.html').raw.toString();
  preloaded = firstLoad.files
    .map((file) => file.path)
    .filter((path) => categorize(path) === 'js' && !html.includes(`"${path}"`));
  const links = preloaded
    .map(
      (path) => `    <link rel="modulepreload" crossorigin href="${path}">\n`
    )
    .join('');
  await server.replace(
    '/index.html',
    Buffer.from(html.replace('</head>', `${links}  </head>`))
  );
}

const runs = Object.fromEntries(
  networks.map((network) => [network.name, { cold: [], warm: [] }])
);
// Round-robin, so drift in the machine's load reaches every network alike.
for (let i = 0; i < samples; i++) {
  for (const network of networks) {
    const context = await newContext();
    try {
      runs[network.name].cold.push(await load(context, network, routes));
      // The same context again: the browser has every file of the landing
      // route, and asks only whether the HTML changed.
      runs[network.name].warm.push(
        await load(context, network, routes.slice(0, 1))
      );
    } finally {
      await context.close();
    }
  }
  process.stderr.write(`${label} ${locale}: sample ${i + 1}/${samples}\n`);
}

// A user who visited the routes comes back after another build was deployed:
// what the browser fetches again, and which translation files it knew have
// other names now.
let redeploy;
if (args.redeploy) {
  const next = resolve(args.redeploy);
  const names = (directory, kind) =>
    readdirSync(directory, { recursive: true })
      .map((file) => `/${file.split(sep).join('/')}`)
      .filter((path) => categorize(path) === kind);
  const before = new Set(names(dist, 'translations'));
  const after = names(next, 'translations');
  const scriptsBefore = new Set(names(dist, 'js'));
  const scriptsAfter = names(next, 'js');
  const context = await newContext();
  try {
    await load(context, unshaped, routes);
    await server.deploy(next);
    const returning = await load(context, unshaped, routes);
    redeploy = {
      dist: relative(root, next),
      translationFiles: after.length,
      translationFilesRenamed: after.filter((path) => !before.has(path)).length,
      // The JavaScript files of every locale's pages that the deploy renamed.
      scripts: scriptsAfter.length,
      scriptsRenamed: scriptsAfter.filter((path) => !scriptsBefore.has(path))
        .length,
      firstLoad: returning.firstLoad,
      afterRoutes: returning.afterRoutes,
    };
  } finally {
    await context.close();
  }
}

const chromiumVersion = browser.version();
await browser.close();
await server.close();

// ===== Report ===== //

const summarizeLoads = (loads) => ({
  rendered: summarize(loads.map((sample) => sample.rendered)),
  frame: summarize(loads.map((sample) => sample.frame)),
  firstText: summarize(loads.map((sample) => sample.firstText)),
  firstTranslated: summarize(loads.map((sample) => sample.firstTranslated)),
  firstContentfulPaint: summarize(
    loads.map((sample) => sample.firstContentfulPaint ?? NaN)
  ),
  ...(loads[0].navigations.length
    ? { navigation: summarize(loads.flatMap((sample) => sample.navigations)) }
    : {}),
  // The page loads that painted source text before the route was translated.
  flashes: loads.filter((sample) => sample.flashFramesAfterRoutes > 0).length,
  flashedText: loads.find((sample) => sample.flashedText)?.flashedText,
});

const cold = Object.values(runs).flatMap((run) => run.cold);
const warm = Object.values(runs).flatMap((run) => run.warm);
const sameBytes = (loads, read) =>
  loads.every(
    (sample) => read(sample).total.bytes === read(loads[0]).total.bytes
  );

const results = {
  kind: 'load',
  label,
  ...environment(),
  chromium: chromiumVersion,
  dist: relative(root, dist),
  app: manifest.name,
  messages: manifest.messages,
  locale,
  translated: Boolean(pageConfig.translatedText),
  routes,
  samples,
  protocol: args.protocol,
  compression: `brotli, quality ${BROTLI_QUALITY}`,
  gzipLevel: GZIP_LEVEL,
  cpu,
  translationFiles: translationFiles.source,
  ...(preloaded ? { preloaded } : {}),
  ...(redeploy ? { redeploy } : {}),
  bytes: {
    firstLoad: cold[0].firstLoad,
    startupJs: cold[0].startupJs,
    afterRoutes: cold[0].afterRoutes,
    warmFirstLoad: warm[0].firstLoad,
    // Whether every page load transferred the same bytes.
    stable:
      sameBytes(cold, (sample) => sample.firstLoad) &&
      sameBytes(cold, (sample) => sample.afterRoutes) &&
      sameBytes(warm, (sample) => sample.firstLoad),
  },
  timings: Object.fromEntries(
    Object.entries(runs).map(([network, run]) => [
      network,
      { cold: summarizeLoads(run.cold), warm: summarizeLoads(run.warm) },
    ])
  ),
};

const out =
  args.out ??
  join(
    root,
    'results',
    'load',
    `${manifest.name ?? 'dist'}-${label}-${locale}.json`
  );
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(results, null, 2) + '\n');

console.log(report([results]));
