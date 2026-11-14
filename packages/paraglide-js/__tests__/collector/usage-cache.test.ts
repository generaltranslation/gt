import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from 'vitest';
import {
  FALLBACK_FILE,
  LOCK_FILE,
  SECTION,
  UsageCache,
} from '../../src/compiler/collector/usage-cache.js';
import { collect, writeProject } from '../helpers/fixture.js';

const LOCK = {
  version: 2,
  branchId: 'brc_test',
  entries: [{ fileId: 'f', versionId: 'v', translations: {} }],
};

const FILES = {
  'src/page.tsx': [
    `import { m } from "./paraglide/messages.js";`,
    `import { label } from "./label";`,
    `export const Page = () => <h1>{m.greeting()}{label(m.greeting)}</h1>;`,
  ].join('\n'),
  'src/label.ts': `export function label(message: () => string) { return message(); }`,
};

async function readLock(root: string): Promise<Record<string, unknown>> {
  return JSON.parse(await fs.readFile(path.join(root, LOCK_FILE), 'utf8'));
}

test('a second run indexes unchanged files from the lock file, and finds the same', async () => {
  const root = await writeProject('usage-cache-warm', {
    ...FILES,
    [LOCK_FILE]: `${JSON.stringify(LOCK, null, 2)}\n`,
  });

  const cold = await collect(root);
  const lock = await readLock(root);
  const section = lock[SECTION] as { files: Record<string, string> };

  // The rest of the lock file is as the CLI wrote it.
  expect({ ...lock, [SECTION]: undefined }).toEqual({
    ...LOCK,
    [SECTION]: undefined,
  });
  expect(Object.keys(section.files)).toEqual(
    expect.arrayContaining(['src/label.ts', 'src/page.tsx'])
  );

  const warm = await collect(root);
  expect(warm.usages).toEqual(cold.usages);
  expect(warm.info.join('\n')).toMatch(/file\(s\) indexed as in the last run/);
  expect(cold.info.join('\n')).not.toMatch(/indexed as in the last run/);
});

test('a changed file is indexed again', async () => {
  const root = await writeProject('usage-cache-change', {
    ...FILES,
    [LOCK_FILE]: `${JSON.stringify(LOCK, null, 2)}\n`,
  });
  await collect(root);
  const before = (
    (await readLock(root))[SECTION] as { files: Record<string, string> }
  ).files;

  await fs.writeFile(
    path.join(root, 'src/label.ts'),
    `export function label(message: () => string) { return message() + "!"; }`
  );
  const warm = await collect(root);
  const after = (
    (await readLock(root))[SECTION] as { files: Record<string, string> }
  ).files;

  expect(after['src/label.ts']).not.toEqual(before['src/label.ts']);
  expect(after['src/page.tsx']).toEqual(before['src/page.tsx']);
  expect(warm.usages.length).toBeGreaterThan(0);
});

test('without a lock file, or past its size limit, the cache is kept in node_modules', async () => {
  const root = await writeProject('usage-cache-fallback', FILES);
  await collect(root);

  await expect(fs.access(path.join(root, LOCK_FILE))).rejects.toThrow();
  const fallback = JSON.parse(
    await fs.readFile(path.join(root, FALLBACK_FILE), 'utf8')
  );
  expect(Object.keys(fallback[SECTION].files).length).toBeGreaterThan(0);

  // Too large for the lock file: it moves to the fallback file.
  await fs.writeFile(path.join(root, LOCK_FILE), JSON.stringify(LOCK));
  const cache = UsageCache.load(root, fallback[SECTION].fingerprint);
  cache.set(path.join(root, 'src/page.tsx'), { hash: 'h' });
  cache.save(10);
  expect(SECTION in (await readLock(root))).toBe(false);
});

test('entries written with another fingerprint are not used', async () => {
  const root = await writeProject('usage-cache-fingerprint', {
    ...FILES,
    [LOCK_FILE]: JSON.stringify(LOCK),
  });
  const file = path.join(root, 'src/page.tsx');

  const cache = UsageCache.load(root, 'one');
  cache.set(file, { hash: 'h' });
  cache.save();

  expect(UsageCache.load(root, 'one').get(file)).toEqual({ hash: 'h' });
  expect(UsageCache.load(root, 'two').get(file)).toBeUndefined();
});
