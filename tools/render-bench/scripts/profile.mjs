// CPU-profiles one expression in an unminified build and prints where the
// time went; the .cpuprofile opens in Chrome DevTools.
//   node scripts/profile.mjs unstable fr "window.__bench.micro()" [pages]
// A cold render is over in milliseconds, so it is profiled in several pages
// and the samples are added up.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { preview } from 'vite';
import { generate } from './generate.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const [variant, locale, expression, pages = '1'] = process.argv.slice(2);
const outDir = `dist/profile-${variant}`;

generate();
execFileSync(
  'pnpm',
  ['exec', 'vite', 'build', '--logLevel', 'warn', '--minify', 'false'],
  {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      BENCH_VARIANT: variant,
      BENCH_OUT_DIR: outDir,
      NODE_ENV: 'production',
    },
  }
);
const server = await preview({
  root,
  configFile: false,
  logLevel: 'warn',
  build: { outDir },
  preview: { port: 0 },
});
const browser = await chromium.launch();
const nameOf = ({ callFrame }) =>
  `${callFrame.functionName || '(anonymous)'} ${callFrame.url.split('/').pop()}:${callFrame.lineNumber + 1}`;
const self = new Map();
const inclusive = new Map();
let total = 0;
let profile;
for (let i = 0; i < Number(pages); i++) {
  const context = await browser.newContext({ locale });
  const page = await context.newPage();
  const session = await context.newCDPSession(page);
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => window.__bench);
  await session.send('Profiler.enable');
  await session.send('Profiler.setSamplingInterval', { interval: 50 });
  await session.send('Profiler.start');
  await page.evaluate(expression);
  ({ profile } = await session.send('Profiler.stop'));
  await context.close();

  const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
  const parents = new Map(
    profile.nodes.flatMap((node) =>
      (node.children ?? []).map((child) => [child, node.id])
    )
  );
  profile.samples.forEach((id, sample) => {
    const time = profile.timeDeltas[sample];
    total += time;
    const own = nameOf(nodes.get(id));
    self.set(own, (self.get(own) ?? 0) + time);
    // A recursive function is counted once per sample.
    const stack = new Set();
    for (let node = id; node !== undefined; node = parents.get(node)) {
      stack.add(nameOf(nodes.get(node)));
    }
    for (const name of stack) {
      inclusive.set(name, (inclusive.get(name) ?? 0) + time);
    }
  });
}
await browser.close();
await server.close();

mkdirSync(join(root, 'results'), { recursive: true });
const file = join(root, 'results', `${variant}-${locale}.cpuprofile`);
writeFileSync(file, JSON.stringify(profile));

const top = (times, count) =>
  [...times]
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(
      ([name, time]) =>
        `${((time / total) * 100).toFixed(1).padStart(5)}%  ${name}`
    )
    .join('\n');

console.log(
  `${file}\n${(total / 1000 / Number(pages)).toFixed(2)} ms per page\n\nSelf time\n${top(self, 30)}`
);
console.log(`\nInclusive time\n${top(inclusive, 50)}`);
