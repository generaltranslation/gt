import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { hashStringMessage } from 'gt-i18n/internal/string';
import { build } from 'vite';
import { expect, it } from 'vitest';
import { gtSvelte, type ManifestEntry } from '../lib/vite/index';

const fixtures = fileURLToPath(new URL('./fixtures', import.meta.url));
const runtimeEntry = fileURLToPath(new URL('../lib/index.ts', import.meta.url));

it('writes every compiled entry to the manifest during vite build', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'gt-svelte-'));
  const manifest = path.join(directory, 'manifest.json');
  try {
    await build({
      root: fixtures,
      configFile: false,
      logLevel: 'silent',
      plugins: [gtSvelte({ manifest }), svelte()],
      resolve: {
        alias: [
          { find: /^gt-svelte$/, replacement: runtimeEntry },
          { find: /^\$i18n$/, replacement: runtimeEntry },
        ],
      },
      build: { ssr: 'entry.ts', write: false },
    });
    const entries = JSON.parse(
      await readFile(manifest, 'utf8')
    ) as ManifestEntry[];

    const hashes = entries.map((entry) => entry.metadata.hash);
    expect(hashes).toEqual([...hashes].sort());
    expect(
      entries
        .map((entry) => [entry.dataFormat, entry.metadata.filePaths])
        .sort()
    ).toEqual([
      ['JSX', ['Greeting.svelte']],
      ['JSX', ['Greeting.svelte']],
      ['JSX', ['Greeting.svelte']],
      ['STRING', ['AliasImport.svelte']],
      ['STRING', ['Greeting.svelte']],
      ['STRING', ['Greeting.svelte']],
      ['STRING', ['messages.ts']],
    ]);
    expect(entries).toContainEqual({
      dataFormat: 'STRING',
      source: 'Documentation',
      metadata: {
        hash: hashStringMessage('Documentation', { $context: 'navigation' }),
        context: 'navigation',
        filePaths: ['messages.ts'],
      },
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
