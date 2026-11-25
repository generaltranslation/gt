import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(root, '.next');
const next = createRequire(import.meta.url).resolve('next/dist/bin/next');
const catalog = JSON.parse(
  readFileSync(join(root, 'public/_gt/fr.json'), 'utf8')
);
const SERVER_T = '3a426e18bfa643bd';
const CLIENT_T = '99a780efcbb529ab';
const ORDERS_SERVER_T = '6862956fa8dc0a94';
const ORDERS_CLIENT_T = '229506742cacee12';
const SHARED_T = '07f79b1e4ceebb32';
// useGT() hashes at runtime, so its translation is always the root's.
const USE_GT = 'dcec2ca4a53c4f6c';
const SERVER_TEXT = 'Ce paragraphe est traduit dans un composant serveur React';
const READY_MS = 30_000;
// What next@16.2.9 sends when a <Link> on / navigates to /orders: the root
// layout stays, so only the segments below it are rendered.
const NAVIGATION_FROM_HOME = {
  RSC: '1',
  'Next-Router-State-Tree': encodeURIComponent(
    JSON.stringify([
      '',
      {
        children: [
          'orders',
          { children: ['__PAGE__', {}, null, null, 0] },
          null,
          'refetch',
          0,
        ],
      },
      null,
      null,
      16,
    ])
  ),
  'Next-Url': '/',
};

function build(bundler, split) {
  rmSync(distDir, { recursive: true, force: true });
  execFileSync(
    process.execPath,
    [next, 'build', ...(bundler === 'webpack' ? ['--webpack'] : [])],
    {
      cwd: root,
      stdio: ['ignore', 'ignore', 'inherit'],
      env: {
        ...process.env,
        CHECK_COMPILER: 'swc',
        CHECK_SPLIT: String(split),
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

async function withServer(requests) {
  const port = await getFreePort();
  const server = spawn(process.execPath, [next, 'start', '-p', String(port)], {
    cwd: root,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  const request = async (path, headers = {}) => {
    const response = await fetch(`http://localhost:${port}${path}`, {
      headers: { 'Accept-Language': 'fr', ...headers },
    });
    return response.text();
  };
  try {
    const deadline = Date.now() + READY_MS;
    for (;;) {
      try {
        await request('/');
        break;
      } catch (error) {
        if (server.exitCode !== null || Date.now() > deadline) throw error;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    return await requests(request);
  } finally {
    server.kill();
    if (server.exitCode === null) await once(server, 'exit');
  }
}

function removeScripts(html) {
  let previous;
  do {
    previous = html;
    html = html.replace(/<script\b[\s\S]*?<\/script[^>]*>/gi, '');
  } while (html !== previous);
  return html;
}

/** The `translations` props in an RSC payload: the root's, then the seeds'. */
function readTranslations(payload) {
  const found = [];
  for (const match of payload.matchAll(/"translations":\{"fr":/g)) {
    const start = match.index + match[0].length;
    let depth = 0;
    let inString = false;
    for (let index = start; index < payload.length; index++) {
      const character = payload[index];
      if (inString) {
        if (character === '\\') index++;
        else if (character === '"') inString = false;
      } else if (character === '"') inString = true;
      else if (character === '{') depth++;
      else if (character === '}' && --depth === 0) {
        found.push(Object.keys(JSON.parse(payload.slice(start, index + 1))));
        break;
      }
    }
  }
  const rootIndex = found.findIndex((hashes) => hashes.includes(USE_GT));
  return {
    rootSet: found[rootIndex] ?? [],
    seeds: found.filter((_, index) => index !== rootIndex),
  };
}

function readPayload(payload) {
  return {
    ...readTranslations(payload),
    sent: Object.keys(catalog).filter((hash) => payload.includes(`"${hash}":`)),
  };
}

function readPage(html) {
  return {
    markup: removeScripts(html),
    ...readPayload(
      [...html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)]
        .map((match) => JSON.parse(match[1]))
        .join('')
    ),
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
const text = (hash) => catalog[hash]?.c;
const catalogWithout = (...hashes) =>
  Object.keys(catalog).filter((hash) => !hashes.includes(hash));

if (existsSync(distDir)) {
  console.error(
    `${distDir} exists, and this check builds into it. Stop any next dev or next start of this app and remove it first.`
  );
  process.exit(1);
}

check(
  'the catalog holds every <T> of both pages',
  [SERVER_T, CLIENT_T, ORDERS_SERVER_T, ORDERS_CLIENT_T, SHARED_T].every(
    (hash) => hash in catalog
  )
);
if (failed) process.exit(1);

const summary = [];
try {
  for (const [bundler, split] of [
    ['turbopack', false],
    ['turbopack', true],
    ['webpack', true],
  ]) {
    build(bundler, split);
    const [home, orders, navigation] = await withServer((request) =>
      Promise.all([
        request('/').then(readPage),
        request('/orders').then(readPage),
        request('/orders', NAVIGATION_FROM_HOME).then(readPayload),
      ])
    );
    const name = `${bundler}, split ${split ? 'on' : 'off'}`;
    const byPage = split && bundler === 'turbopack';

    check(
      `${name}: renders every <T> of / in French`,
      home.markup.includes(SERVER_TEXT) &&
        [CLIENT_T, SHARED_T].every((hash) => home.markup.includes(text(hash)))
    );
    check(
      `${name}: renders every <T> of /orders in French`,
      [ORDERS_SERVER_T, ORDERS_CLIENT_T, SHARED_T].every((hash) =>
        orders.markup.includes(text(hash))
      )
    );

    const serverOnly = split ? [SERVER_T, ORDERS_SERVER_T] : [];
    check(
      `${name}: / sends ${
        !split
          ? 'every translation'
          : byPage
            ? 'every translation but those of server <T> and of the client <T> of /orders'
            : 'every translation but those of server <T>'
      }`,
      same(
        home.sent,
        catalogWithout(...serverOnly, ...(byPage ? [ORDERS_CLIENT_T] : []))
      ),
      `sent ${home.sent.join(', ')}`
    );
    check(
      `${name}: a navigation from / to /orders leaves the root's translations out`,
      !navigation.rootSet.length,
      `root ${navigation.rootSet.join(', ')}`
    );
    check(
      `${name}: / and a navigation from it to /orders send every client <T> of /orders`,
      [ORDERS_CLIENT_T, SHARED_T].every(
        (hash) =>
          home.rootSet.includes(hash) || navigation.seeds.flat().includes(hash)
      )
    );
    if (byPage) {
      check(
        `${name}: / seeds the translation only its client component uses`,
        !home.rootSet.includes(CLIENT_T) && same(home.seeds.flat(), [CLIENT_T]),
        `root ${home.rootSet.join(', ')}; seeds ${home.seeds.join(' | ')}`
      );
      check(
        `${name}: /orders and a navigation to it seed the translation only its client component uses`,
        !orders.rootSet.includes(ORDERS_CLIENT_T) &&
          same(orders.seeds.flat(), [ORDERS_CLIENT_T]) &&
          same(navigation.seeds.flat(), [ORDERS_CLIENT_T]),
        `seeds ${orders.seeds.join(' | ')}; navigation seeds ${navigation.seeds.join(' | ')}`
      );
      check(
        `${name}: the root sends the translation both pages use, and no seed does`,
        [home, orders].every(
          ({ rootSet, seeds }) =>
            rootSet.includes(SHARED_T) && !seeds.flat().includes(SHARED_T)
        )
      );
    } else {
      check(
        `${name}: seeds no page`,
        [home, orders, navigation].every(({ seeds }) => !seeds.length)
      );
    }
    summary.push(
      `${name}: catalog entries of ${Object.keys(catalog).length} in the RSC payload of / ${home.sent.length}, of /orders ${orders.sent.length}, of a navigation from / to /orders ${navigation.sent.length}`
    );
  }
} finally {
  rmSync(distDir, { recursive: true, force: true });
}

console.log(`\n${summary.join('\n')}`);

if (failed) {
  console.error(`\n${failed} checks failed`);
  process.exit(1);
}
console.log('\nEvery check passed');
