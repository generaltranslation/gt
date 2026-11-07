// Checks a production build that embeds fr translations at call sites and
// loads only fr's msg() strings at runtime (translations/fr.msg.json, via
// loadTranslations.ts). `next dev` doesn't embed, so this has to run against
// `next build` output.
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const appDir = fileURLToPath(new URL('..', import.meta.url));
const port = Number(process.env.PORT ?? 3021);
const baseUrl = `http://127.0.0.1:${port}`;

const cases = [
  {
    locale: 'fr',
    expected: [
      // Embedded by the compiler from translations/fr.json
      'Chaîne intégrée',
      // Loaded from translations/fr.msg.json
      'Salutation message',
      'Première étape',
      'Deuxième étape',
    ],
  },
  {
    locale: 'en',
    expected: [
      'Embedded string',
      'Message greeting',
      'First step',
      'Second step',
    ],
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

// Drops scripts, whose RSC payload carries GTProvider's translation snapshot,
// so only rendered markup is checked
const fetchRenderedHtml = async (locale) =>
  (await fetchPage(locale)).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

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
    const html = await fetchRenderedHtml(locale);
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

  // The client resolves msg() strings from the translations snapshot
  // GTProvider sends, including msg() from a module only the server imports.
  // The RSC payload only carries client component props and that snapshot,
  // so it shows what the client received.
  const pageRsc = await fetchPage('fr', '/', { RSC: '1' });
  const serverOnlyRsc = await fetchPage('fr', '/server-only', { RSC: '1' });
  const snapshotChecks = [
    ['has msg() strings', pageRsc.includes('Salutation message')],
    [
      'has the server-only msg() string',
      serverOnlyRsc.includes('Salutation serveur'),
    ],
    // Only the msg()-only file loads, not the full fr.json
    ['leaves out embedded strings', !pageRsc.includes('Chaîne intégrée')],
  ];
  for (const [label, ok] of snapshotChecks) {
    if (ok) {
      console.log(`[fr] translations snapshot ${label}`);
    } else {
      failed = true;
      console.error(`[fr] translations snapshot check failed: ${label}`);
    }
  }
} catch (error) {
  failed = true;
  console.error(error);
} finally {
  server.kill();
}

process.exit(failed ? 1 : 0);
