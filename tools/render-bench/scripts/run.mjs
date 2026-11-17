// Builds every variant, then measures each in headless Chromium.
//   node scripts/run.mjs [--n 20] [--variants unstable,floor] [--label name]
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { chromium } from 'playwright-core';
import { preview } from 'vite';
import { generate, KINDS, ROUTE_SIZE } from './generate.mjs';
import { median, report } from './report.mjs';
import { variants as allVariants } from './variants.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const git = (...args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

const { values: args } = parseArgs({
  options: {
    n: { type: 'string', default: '20' },
    variants: { type: 'string' },
    label: { type: 'string' },
  },
});
const samples = Number(args.n);
const sha =
  git('rev-parse', '--short', 'HEAD') +
  (git('status', '--porcelain', '--', '../../packages') ? '-dirty' : '');
const label = args.label ?? sha;

const variants = args.variants?.split(',') ?? Object.keys(allVariants);

// ===== Build and serve ===== //

generate();
const MEASURED_LOCALES = ['fr', 'en'];
const servers = {};
// A per-locale variant is one build per locale; the others serve every locale.
const buildOf = (variant, locale) =>
  allVariants[variant].perLocale ? `${variant}-${locale}` : variant;
for (const variant of variants) {
  const { perLocale, env } = allVariants[variant];
  for (const locale of perLocale ? MEASURED_LOCALES : [undefined]) {
    const name = locale ? buildOf(variant, locale) : variant;
    execFileSync('pnpm', ['exec', 'vite', 'build', '--logLevel', 'warn'], {
      cwd: root,
      stdio: 'inherit',
      env: {
        ...process.env,
        ...env,
        ...(locale && { GT_STATIC_LOCALE: locale }),
        BENCH_VARIANT: variant,
        BENCH_OUT_DIR: `dist/${name}`,
        NODE_ENV: 'production',
      },
    });
    servers[name] = await preview({
      root,
      configFile: false,
      logLevel: 'warn',
      build: { outDir: `dist/${name}` },
      preview: {
        port: 0,
        // Cross-origin isolation gives performance.now() its 5µs resolution.
        headers: {
          'Cross-Origin-Opener-Policy': 'same-origin',
          'Cross-Origin-Embedder-Policy': 'require-corp',
        },
      },
    });
  }
}

// ===== Measure ===== //

const browser = await chromium.launch();

/** Runs `measure` in a new page, so every sample imports and renders cold. */
async function samplePage(variant, { locale, cpu }, measure, argument) {
  const context = await browser.newContext({ locale });
  try {
    const page = await context.newPage();
    const session = await context.newCDPSession(page);
    await session.send('Emulation.setCPUThrottlingRate', { rate: cpu });
    await page.goto(servers[buildOf(variant, locale)].resolvedUrls.local[0]);
    await page.waitForFunction(() => window.__bench);
    return await page.evaluate(measure, argument);
  } finally {
    await context.close();
  }
}

// A wrong hash or an unloaded locale renders the source, which costs less.
function checkItems(task, items, expected) {
  const translated = items.filter((item) =>
    item.includes(`[${task.locale}]`)
  ).length;
  const wanted = task.locale === 'en' ? 0 : expected;
  if (items.length !== expected || translated !== wanted) {
    throw new Error(
      `${task.variant} ${task.name} (${task.locale}): rendered ${items.length} messages, ${translated} translated; expected ${expected} and ${wanted}`
    );
  }
}

const mountAndUpdate = async (mount) => {
  const mounted = await mount();
  return {
    mount: mounted,
    update: window.__bench.update(),
    items: window.__bench.items(),
  };
};

const tasks = variants.flatMap((variant) => [
  ...[1, 10].flatMap((routes) =>
    [1, 4].flatMap((cpu) =>
      MEASURED_LOCALES.map((locale) => ({
        variant,
        group: 'render',
        name: `${routes * ROUTE_SIZE} strings, ${cpu}x CPU, ${locale}`,
        locale,
        cpu,
        expected: routes * ROUTE_SIZE,
        measure: (count) => window.__bench.mount(count),
        argument: routes,
      }))
    )
  ),
  ...KINDS.map((kind) => ({
    variant,
    group: 'kind',
    name: kind,
    locale: 'fr',
    cpu: 1,
    expected: ROUTE_SIZE,
    measure: (name) => window.__bench.mountKind(name),
    argument: kind,
  })),
  ...MEASURED_LOCALES.map((locale) => ({
    variant,
    group: 'micro',
    name: locale,
    locale,
    cpu: 1,
  })),
]);

for (const task of tasks) task.samples = [];
// Round-robin, so drift in the machine's load reaches every task alike.
for (let i = 0; i < samples; i++) {
  for (const task of tasks) {
    if (task.group === 'micro') {
      task.samples.push(
        await samplePage(task.variant, task, () => window.__bench.micro())
      );
      continue;
    }
    const { items, ...sample } = await samplePage(
      task.variant,
      task,
      // Serialized into the page, where it rebuilds the task's measurement.
      `(${mountAndUpdate})(() => (${task.measure})(${JSON.stringify(task.argument)}))`
    );
    if (i === 0) checkItems(task, items, task.expected);
    task.samples.push(sample);
  }
  process.stderr.write(`sample ${i + 1}/${samples}\n`);
}

const chromiumVersion = browser.version();
await browser.close();
await Promise.all(Object.values(servers).map((server) => server.close()));

// ===== Report ===== //

const medians = (task, read) => median(task.samples.map(read));
const results = {
  label,
  sha,
  date: new Date().toISOString(),
  machine: cpus()[0].model,
  chromium: chromiumVersion,
  samples,
  variants,
  render: {},
  kind: {},
  micro: {},
};
for (const task of tasks) {
  const group = (results[task.group][task.name] ??= {});
  group[task.variant] =
    task.group === 'micro'
      ? Object.fromEntries(
          Object.keys(task.samples[0]).map((kind) => [
            kind,
            {
              first: medians(task, (sample) => sample[kind].first),
              warm: medians(task, (sample) => sample[kind].warm),
            },
          ])
        )
      : {
          mount: medians(task, (sample) => sample.mount),
          update: medians(task, (sample) => sample.update),
        };
}

mkdirSync(join(root, 'results'), { recursive: true });
writeFileSync(
  join(root, 'results', `${label}.json`),
  JSON.stringify(results, null, 2) + '\n'
);
console.log(report(results));
