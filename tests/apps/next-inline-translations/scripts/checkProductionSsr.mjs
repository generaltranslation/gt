// Checks the server-rendered HTML of a production build for inline
// translations registered by module-level msg() calls. `next dev` bundles the
// server differently, so this has to run against `next build` output.
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const appDir = fileURLToPath(new URL('..', import.meta.url));
const port = Number(process.env.PORT ?? 3021);
const baseUrl = `http://127.0.0.1:${port}`;

const cases = [
  {
    locale: 'fr',
    expected: ['Salutation intégrée', 'Première étape', 'Deuxième étape'],
  },
  {
    locale: 'en',
    expected: ['Inline greeting', 'First step', 'Second step'],
  },
];

const server = spawn(
  'pnpm',
  ['exec', 'next', 'start', '--port', String(port)],
  { cwd: appDir, stdio: ['ignore', 'pipe', 'pipe'] }
);
let serverOutput = '';
server.stdout.on('data', (chunk) => (serverOutput += chunk));
server.stderr.on('data', (chunk) => (serverOutput += chunk));

async function fetchPage(locale, path = '/', headers = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      cookie: `generaltranslation.locale=${locale}`,
      'accept-language': locale,
      ...headers,
    },
  });
  if (!response.ok) {
    throw new Error(`GET ${path} (${locale}) -> ${response.status}`);
  }
  return response.text();
}

const fetchHtml = (locale) => fetchPage(locale);

async function waitForServer() {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (server.exitCode !== null) break;
    try {
      await fetch(baseUrl);
      return;
    } catch {
      await delay(500);
    }
  }
  throw new Error(`next start did not become ready:\n${serverOutput}`);
}

let failed = false;
try {
  await waitForServer();
  for (const { locale, expected } of cases) {
    const html = await fetchHtml(locale);
    const missing = expected.filter((text) => !html.includes(text));
    if (missing.length) {
      failed = true;
      console.error(
        `[${locale}] server-rendered HTML is missing: ${missing.join(', ')}`
      );
    } else {
      console.log(`[${locale}] server-rendered HTML has the expected text`);
    }
  }

  // msg() in a module only the server imports never registers on the client,
  // so the client resolves it from the GTProvider translations snapshot. The
  // client component renders the message itself, so the RSC payload only
  // contains the translation if the snapshot carries it.
  const rscPayload = await fetchPage('fr', '/server-only', { RSC: '1' });
  if (!rscPayload.includes('Salutation serveur')) {
    failed = true;
    console.error(
      '[fr] translations snapshot is missing the server-only msg() string'
    );
  } else {
    console.log('[fr] translations snapshot has the server-only msg() string');
  }
} catch (error) {
  failed = true;
  console.error(error);
} finally {
  server.kill();
}

process.exit(failed ? 1 : 0);
