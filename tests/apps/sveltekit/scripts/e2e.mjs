import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { startMockGtApi } from './mock-gt-api.mjs';
import { appDir, pageText, readJson, run, startServer } from './serve.mjs';

const catalogPath = path.join(appDir, 'src/_gt/fr.json');
const configPath = path.join(appDir, 'gt.config.json');
const pagePath = path.join(appDir, 'src/routes/+page.svelte');

/** Runs `gt translate` against the mock API without touching real credentials. */
function translate(api) {
  return run('pnpm', ['exec', 'gt', 'translate', '--skip-version-check'], {
    GT_API_KEY: api.apiKey,
    GT_PROJECT_ID: api.projectId,
    GT_API_URL: api.url,
  });
}

function log(message) {
  process.stdout.write(`${message}\n`);
}

const originalConfig = await readFile(configPath, 'utf8');
const originalPage = await readFile(pagePath, 'utf8');
const api = await startMockGtApi();
let server;
try {
  await writeFile(catalogPath, '{}\n');

  log('1. vite build writes the manifest');
  await run('pnpm', ['exec', 'vite', 'build']);
  const manifest = await readJson('.gt/inline-manifest.json');
  assert.equal(manifest.length, 9);

  log('2. gt translate sends every entry to the mock API');
  await translate(api);
  log(`   requests: ${[...new Set(api.requests)].join(', ')}`);
  assert.deepEqual(
    [...api.sentHashes].sort(),
    manifest.map((entry) => entry.metadata.hash).sort()
  );
  const catalog = await readJson('src/_gt/fr.json');
  assert.deepEqual(
    Object.keys(catalog).sort(),
    manifest.map((entry) => entry.metadata.hash).sort()
  );

  log('3. the rebuilt app renders the random translations on the server');
  await run('pnpm', ['exec', 'vite', 'build']);
  server = await startServer();
  const heading = manifest.find(
    (entry) => entry.source === 'Welcome to the Svelte test app'
  );
  const french = await pageText(server.url, 'fr');
  const english = await pageText(server.url, 'en');
  assert.ok(french.includes(catalog[heading.metadata.hash]), french);
  assert.ok(english.includes('Welcome to the Svelte test app'), english);
  assert.ok(
    english.includes('Hello Ada, you have 1,234 new messages.'),
    english
  );

  log('4. a second gt translate sends nothing');
  api.sentHashes.clear();
  const output = await translate(api);
  assert.equal(api.sentHashes.size, 0, output);
  assert.match(output, /0 of 9 gt-svelte entries need translation/);
  assert.deepEqual(await readJson('src/_gt/fr.json'), catalog);

  log('5. a catalog emptied after a download is filled again');
  await writeFile(catalogPath, '{}\n');
  await translate(api);
  assert.deepEqual(await readJson('src/_gt/fr.json'), catalog);

  log('6. changing one string sends only that entry');
  await writeFile(
    pagePath,
    originalPage.replace("gt('About this app')", "gt('About this test app')")
  );
  await run('pnpm', ['exec', 'vite', 'build']);
  const changed = await readJson('.gt/inline-manifest.json');
  const removed = manifest.find((entry) => entry.source === 'About this app');
  const added = changed.find((entry) => entry.source === 'About this test app');
  api.sentHashes.clear();
  await translate(api);
  assert.deepEqual([...api.sentHashes], [added.metadata.hash]);
  const updated = await readJson('src/_gt/fr.json');
  const { [removed.metadata.hash]: _removed, ...unchanged } = catalog;
  assert.deepEqual(updated, {
    ...unchanged,
    [added.metadata.hash]: updated[added.metadata.hash],
  });
  await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);

  log('End-to-end translation with the mock API passed.');
} finally {
  server?.close();
  await api.close();
  await writeFile(configPath, originalConfig);
  await writeFile(pagePath, originalPage);
}
