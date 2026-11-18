import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Settings, Updates } from '../../types/index.js';
import {
  mergeSvelteCatalog,
  readSvelteManifest,
  readSvelteManifestHashes,
  selectUntranslatedUpdates,
} from '../manifest.js';

const updates: Updates = [
  { dataFormat: 'STRING', source: 'Hello', metadata: { hash: 'a' } },
  { dataFormat: 'STRING', source: 'Docs', metadata: { hash: 'b' } },
  {
    dataFormat: 'JSX',
    source: ['Hi ', { t: 'b', i: 1, c: 'there' }],
    metadata: { hash: 'c' },
  },
];

let directory: string;

beforeEach(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-svelte-manifest-'));
});

afterEach(() => {
  fs.rmSync(directory, { recursive: true, force: true });
});

function write(file: string, value: unknown): string {
  const target = path.join(directory, file);
  fs.writeFileSync(target, JSON.stringify(value));
  return target;
}

describe('readSvelteManifest', () => {
  it('returns the manifest entries as updates', async () => {
    const svelteManifest = write('manifest.json', updates);
    await expect(readSvelteManifest({ svelteManifest })).resolves.toEqual({
      updates,
      errors: [],
      warnings: [],
    });
    expect(readSvelteManifestHashes({ svelteManifest })).toEqual(
      new Set(['a', 'b', 'c'])
    );
  });

  it.each([
    ['missing', undefined, /No gt-svelte manifest was found/],
    ['not an entry list', { a: 1 }, /is not valid/],
  ])('reports a %s manifest', async (_name, content, message) => {
    const svelteManifest =
      content === undefined
        ? path.join(directory, 'missing.json')
        : write('manifest.json', content);
    const result = await readSvelteManifest({ svelteManifest });
    expect(result.updates).toEqual([]);
    expect(result.errors).toEqual([expect.stringMatching(message)]);
    expect(readSvelteManifestHashes({ svelteManifest })).toBeUndefined();
  });
});

describe('selectUntranslatedUpdates', () => {
  it('keeps entries a target catalog lacks or holds only as a source placeholder', () => {
    write('fr.json', {
      a: 'Bonjour',
      b: 'Docs',
      c: ['Salut ', { i: 1, c: 'toi' }],
    });
    write('es.json', { a: 'Hola', b: 'Documentos' });
    const settings = {
      defaultLocale: 'en',
      locales: ['en', 'fr', 'es'],
      files: {
        placeholderPaths: { gt: path.join(directory, '[locale].json') },
      },
    } as unknown as Settings;
    expect(
      selectUntranslatedUpdates(updates, settings).map(
        (update) => update.metadata.hash
      )
    ).toEqual(['b', 'c']);
  });
});

describe('mergeSvelteCatalog', () => {
  it('adds downloaded entries and drops hashes the manifest no longer has', () => {
    expect(
      JSON.parse(
        mergeSvelteCatalog(
          JSON.stringify({ a: 'Bonjour', stale: 'Vieux' }),
          JSON.stringify({ b: 'Documentation' }),
          new Set(['a', 'b'])
        )
      )
    ).toEqual({ a: 'Bonjour', b: 'Documentation' });
  });

  it('keeps every entry when the manifest cannot be read', () => {
    expect(
      JSON.parse(
        mergeSvelteCatalog('not json', JSON.stringify({ b: 'Docs' }), undefined)
      )
    ).toEqual({ b: 'Docs' });
  });
});
