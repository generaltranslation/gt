import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const next = createRequire(import.meta.url).resolve('next/dist/bin/next');
const catalog = JSON.parse(
  readFileSync(join(root, 'public/_gt/fr.json'), 'utf8')
);
const SERVER_T = '3a426e18bfa643bd';
const CLIENT_T = '99a780efcbb529ab';
const SERVER_TEXT = 'Ce paragraphe est traduit dans un composant serveur React';
const CLIENT_TEXT = catalog[CLIENT_T]?.c;
const READY_MS = 30_000;

function build(bundler, split) {
  rmSync(join(root, '.next'), { recursive: true, force: true });
  execFileSync(
    process.execPath,
    [next, 'build', ...(bundler === 'webpack' ? ['--webpack'] : [])],
    {
      cwd: root,
      stdio: ['ignore', 'ignore', 'inherit'],
      env: {
        ...process.env,
        CHECK_COMPILER: 'swc',
        GT_SPLIT_TRANSLATIONS: String(split),
      },
    }
  );
}

async function getFreePort() {
  const server = createServer().listen(0);
  await once(server, 'listening');
  const { port } = server.address();
  server.close();
  return port;
}

async function fetchFrenchPage() {
  const port = await getFreePort();
  const server = spawn(process.execPath, [next, 'start', '-p', String(port)], {
    cwd: root,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  try {
    const deadline = Date.now() + READY_MS;
    for (;;) {
      try {
        const response = await fetch(`http://localhost:${port}/`, {
          headers: { 'Accept-Language': 'fr' },
        });
        return await response.text();
      } catch (error) {
        if (server.exitCode !== null || Date.now() > deadline) throw error;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
  } finally {
    server.kill();
    if (server.exitCode === null) await once(server, 'exit');
  }
}

function readPage(html) {
  const payload = [
    ...html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g),
  ]
    .map((match) => JSON.parse(match[1]))
    .join('');
  return {
    markup: html.replace(/<script\b[\s\S]*?<\/script>/g, ''),
    sent: Object.keys(catalog).filter((hash) => payload.includes(`"${hash}":`)),
  };
}

let failed = 0;
function check(name, passed, detail = '') {
  if (!passed) failed++;
  console.log(
    `${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`
  );
}

const same = (a, b) => [...a].sort().join() === [...b].sort().join();

check(
  'the catalog holds the server and the client <T>',
  SERVER_T in catalog && CLIENT_T in catalog
);
if (failed) process.exit(1);

const summary = [];
try {
  for (const bundler of ['turbopack', 'webpack']) {
    for (const split of [true, false]) {
      build(bundler, split);
      const { markup, sent } = readPage(await fetchFrenchPage());
      const name = `${bundler}, split ${split ? 'on' : 'off'}`;
      check(
        `${name}: renders the server <T> in French`,
        markup.includes(SERVER_TEXT)
      );
      check(
        `${name}: renders the client <T> in French`,
        markup.includes(CLIENT_TEXT)
      );
      check(
        `${name}: sends client components the translation of the client <T>`,
        sent.includes(CLIENT_T)
      );
      const expected = Object.keys(catalog).filter(
        (hash) => !split || hash !== SERVER_T
      );
      check(
        split
          ? `${name}: sends every translation but that of the server <T>`
          : `${name}: sends every translation`,
        same(sent, expected),
        `sent ${sent.join(', ')}`
      );
      summary.push(
        `${name}: ${sent.length} of ${Object.keys(catalog).length} catalog entries in the RSC payload`
      );
    }
  }
} finally {
  rmSync(join(root, '.next'), { recursive: true, force: true });
}

console.log(`\n${summary.join('\n')}`);

if (failed) {
  console.error(`\n${failed} checks failed`);
  process.exit(1);
}
console.log('\nEvery check passed');
