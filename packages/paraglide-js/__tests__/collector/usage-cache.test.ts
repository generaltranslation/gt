import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { afterEach, expect, test, vi } from 'vitest';
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

afterEach(() => {
  vi.restoreAllMocks();
});

test('a second run indexes unchanged files from the lock file, and finds the same', async () => {
  const root = await writeProject('usage-cache-warm', {
    ...FILES,
    [LOCK_FILE]: `${JSON.stringify(LOCK, null, 2)}\n`,
  });

  const cold = await collect(root, { cache: true });
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

  const warm = await collect(root, { cache: true });
  expect(warm.usages).toEqual(cold.usages);
  expect(warm.info.join('\n')).toMatch(/file\(s\) indexed as in the last run/);
  expect(cold.info.join('\n')).not.toMatch(/indexed as in the last run/);
});

test('without `cache`, a run neither uses nor rewrites the section of the lock file', async () => {
  const root = await writeProject('usage-cache-disabled', {
    ...FILES,
    [LOCK_FILE]: JSON.stringify(LOCK),
  });
  const cached = await collect(root, { cache: true });
  const lock = await fs.readFile(path.join(root, LOCK_FILE), 'utf8');
  expect(JSON.parse(lock)).toHaveProperty(SECTION);

  const uncached = await collect(root);

  expect(uncached.usages).toEqual(cached.usages);
  expect(uncached.info.join('\n')).not.toMatch(/as in the last run/);
  expect(await fs.readFile(path.join(root, LOCK_FILE), 'utf8')).toBe(lock);
});

test('without `cache`, a run writes no lock file and no fallback file', async () => {
  const root = await writeProject('usage-cache-disabled-fallback', FILES);
  const { usages } = await collect(root);

  expect(usages.length).toBeGreaterThan(0);
  await expect(fs.access(path.join(root, LOCK_FILE))).rejects.toThrow();
  await expect(fs.access(path.join(root, FALLBACK_FILE))).rejects.toThrow();
});

test('a changed file is indexed again', async () => {
  const root = await writeProject('usage-cache-change', {
    ...FILES,
    [LOCK_FILE]: `${JSON.stringify(LOCK, null, 2)}\n`,
  });
  await collect(root, { cache: true });
  const before = (
    (await readLock(root))[SECTION] as { files: Record<string, string> }
  ).files;

  await fs.writeFile(
    path.join(root, 'src/label.ts'),
    `export function label(message: () => string) { return message() + "!"; }`
  );
  const warm = await collect(root, { cache: true });
  const after = (
    (await readLock(root))[SECTION] as { files: Record<string, string> }
  ).files;

  expect(after['src/label.ts']).not.toEqual(before['src/label.ts']);
  expect(after['src/page.tsx']).toEqual(before['src/page.tsx']);
  expect(warm.usages.length).toBeGreaterThan(0);
});

test('without a lock file, or past its size limit, the cache is kept in node_modules', async () => {
  const root = await writeProject('usage-cache-fallback', FILES);
  await collect(root, { cache: true });

  await expect(fs.access(path.join(root, LOCK_FILE))).rejects.toThrow();
  const fallback = JSON.parse(
    await fs.readFile(path.join(root, FALLBACK_FILE), 'utf8')
  );
  expect(Object.keys(fallback[SECTION].files).length).toBeGreaterThan(0);

  // Too large for the lock file: it moves to the fallback file.
  await fs.writeFile(path.join(root, LOCK_FILE), JSON.stringify(LOCK));
  const cache = UsageCache.load(root, fallback[SECTION].fingerprint);
  cache.set(path.join(root, 'src/page.tsx'), { hash: 'h' });
  await cache.save(10);
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
  await cache.save();

  expect(UsageCache.load(root, 'one').previous(file)).toEqual({ hash: 'h' });
  expect(UsageCache.load(root, 'two').previous(file)).toBeUndefined();
});

test('a lock file that is not JSON, e.g. with conflict markers, leaves the cache in node_modules', async () => {
  const conflicted = '<<<<<<< ours\n{}\n=======\n{}\n>>>>>>> theirs\n';
  const root = await writeProject('usage-cache-conflicted', {
    ...FILES,
    [LOCK_FILE]: conflicted,
  });
  await collect(root, { cache: true });

  expect(await fs.readFile(path.join(root, LOCK_FILE), 'utf8')).toBe(
    conflicted
  );
  const fallback = JSON.parse(
    await fs.readFile(path.join(root, FALLBACK_FILE), 'utf8')
  );
  expect(Object.keys(fallback[SECTION].files).length).toBeGreaterThan(0);
});

test('an unchanged auto-imported module is indexed as in the last run', async () => {
  const root = await writeProject('usage-cache-auto-import', {
    'src/main.ts': 'export const text = t.greeting();\n',
    'src/i18n.ts': `export { m as t } from "./paraglide/messages.js";\n`,
    'auto-imports.d.ts': [
      'export {}',
      'declare global {',
      "  const t: typeof import('./src/i18n')['t']",
      '}',
    ].join('\n'),
    [LOCK_FILE]: JSON.stringify(LOCK),
  });
  await collect(root, { cache: true });
  const section = (await readLock(root))[SECTION] as {
    files: Record<string, string>;
  };
  expect(Object.keys(section.files).sort()).toEqual([
    'src/i18n.ts',
    'src/main.ts',
  ]);

  const { info } = await collect(root, { cache: true });
  expect(info.join('\n')).toMatch(/; 2 file\(s\) indexed as in the last run/);
});

const encode = (value: unknown) =>
  zlib.deflateRawSync(JSON.stringify(value)).toString('base64');

test.each([
  // Bytes, which `Buffer.from` takes as well.
  ['is not a string', [...zlib.deflateRawSync(JSON.stringify({ hash: 'b' }))]],
  ['has no hash', encode({ summary: [] })],
  [
    'has a summary of another shape',
    encode({ hash: 'h', summary: [{ specifiers: 'a' }] }),
  ],
  // 1 KB that expands to 1 MB.
  [
    'expands far past its length',
    encode({ hash: 'h', padding: 'a'.repeat(1_000_000) }),
  ],
])('an entry that %s is not used', async (_, entry) => {
  const root = await writeProject('usage-cache-invalid', {
    [LOCK_FILE]: JSON.stringify(LOCK),
  });
  const [valid, invalid] = ['src/a.ts', 'src/b.ts'].map((file) =>
    path.join(root, file)
  );
  const cache = UsageCache.load(root, 'f');
  cache.set(valid!, { hash: 'a' });
  cache.set(invalid!, { hash: 'b' });
  await cache.save();

  const lock = await readLock(root);
  (lock[SECTION] as { files: Record<string, unknown> }).files['src/b.ts'] =
    entry;
  await fs.writeFile(path.join(root, LOCK_FILE), JSON.stringify(lock));

  const loaded = UsageCache.load(root, 'f');
  expect(loaded.previous(valid!)).toEqual({ hash: 'a' });
  expect(loaded.previous(invalid!)).toBeUndefined();
});

test('a section whose files are not an object is not used', async () => {
  const root = await writeProject('usage-cache-no-files', {
    [LOCK_FILE]: JSON.stringify(LOCK),
  });
  const file = path.join(root, 'src/a.ts');
  const cache = UsageCache.load(root, 'f');
  cache.set(file, { hash: 'a' });
  await cache.save();

  const lock = await readLock(root);
  (lock[SECTION] as { files: unknown }).files = null;
  await fs.writeFile(path.join(root, LOCK_FILE), JSON.stringify(lock));

  expect(UsageCache.load(root, 'f').previous(file)).toBeUndefined();
});

test('a lock file another process writes meanwhile is kept, and the cache goes to node_modules', async () => {
  const root = await writeProject('usage-cache-concurrent', {
    [LOCK_FILE]: JSON.stringify(LOCK),
  });
  const lockFile = path.join(root, LOCK_FILE);
  const theirs = `${JSON.stringify({ ...LOCK, entries: [] }, null, 2)}\n`;

  // As `gt download` would, while the cache writes its temporary file.
  const open = fs.open.bind(fs);
  vi.spyOn(fs, 'open').mockImplementation(async (file, flags) => {
    const isLockTemporary =
      String(file).startsWith(`${lockFile}.`) && flags === 'w';
    if (isLockTemporary) await fs.writeFile(lockFile, theirs);

    return open(file, flags);
  });

  const cache = UsageCache.load(root, 'f');
  cache.set(path.join(root, 'src/a.ts'), { hash: 'a' });
  await cache.save();

  expect(await fs.readFile(lockFile, 'utf8')).toBe(theirs);
  expect(
    (await fs.readdir(root)).filter((name) => name.endsWith('.tmp'))
  ).toEqual([]);
  const fallback = JSON.parse(
    await fs.readFile(path.join(root, FALLBACK_FILE), 'utf8')
  );
  expect(Object.keys(fallback[SECTION].files)).toEqual(['src/a.ts']);
});
