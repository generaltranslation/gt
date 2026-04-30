import fs from 'fs';
import os from 'os';
import path from 'path';
import { clearTimeout, setTimeout } from 'timers';
import { afterEach, describe, expect, it } from 'vitest';
import {
  extractSources,
  postFilterPath,
  preFilterSource,
} from '../buildResolutionGraph';
import { createResolutionCache, createResolver } from '../createResolver';
import type { NativeResolver } from '../types';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gt-resolution-'));
  tempDirs.push(dir);
  return dir;
}

function writeFile(filePath: string, code: string): string {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, code);
  return filePath;
}

function createFilesystemResolver(): NativeResolver {
  const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];

  return async (source, importer) => {
    if (!importer) return null;
    const base = path.resolve(path.dirname(importer), source);
    for (const extension of extensions) {
      const candidate = base + extension;
      if (fs.existsSync(candidate)) {
        return { id: candidate };
      }
    }
    return null;
  };
}

describe('resolution source extraction', () => {
  it('extracts static imports, exports, dynamic import(), and require()', async () => {
    const dir = createTempDir();
    const filePath = writeFile(
      path.join(dir, 'entry.ts'),
      [
        "import value from './imported';",
        "export { value } from './named-export';",
        "export * from './all-export';",
        "const required = require('./required');",
        "const lazy = import('./lazy');",
        'const ignored = require(dynamicValue);',
      ].join('\n')
    );

    await expect(extractSources(filePath)).resolves.toEqual([
      './imported',
      './named-export',
      './all-export',
      './required',
      './lazy',
    ]);
  });

  it('returns no sources for files that cannot be parsed', async () => {
    const dir = createTempDir();
    const filePath = writeFile(path.join(dir, 'broken.ts'), 'const = ;');

    await expect(extractSources(filePath)).resolves.toEqual([]);
  });
});

describe('resolution filtering', () => {
  it('pre-filters non-relative and node_modules sources', () => {
    expect(preFilterSource('./local')).toBe(true);
    expect(preFilterSource('../local')).toBe(true);
    expect(preFilterSource('gt-next')).toBe(false);
    expect(preFilterSource('./node_modules/pkg')).toBe(false);
  });

  it('post-filters missing files, unsupported extensions, and node_modules', async () => {
    const dir = createTempDir();
    const sourceFile = writeFile(path.join(dir, 'source.ts'), '');
    const jsonFile = writeFile(path.join(dir, 'source.json'), '{}');
    const nodeModuleFile = writeFile(
      path.join(dir, 'node_modules', 'pkg', 'index.ts'),
      ''
    );

    await expect(postFilterPath(sourceFile)).resolves.toBe(true);
    await expect(postFilterPath(`${sourceFile}?raw`)).resolves.toBe(true);
    await expect(postFilterPath(jsonFile)).resolves.toBe(false);
    await expect(postFilterPath(nodeModuleFile)).resolves.toBe(false);
    await expect(postFilterPath(path.join(dir, 'missing.ts'))).resolves.toBe(
      false
    );
  });
});

describe('createResolver', () => {
  it('builds a recursive local resolution graph backed by the native resolver', async () => {
    const dir = createTempDir();
    const entry = writeFile(
      path.join(dir, 'entry.ts'),
      [
        "import './a';",
        "const b = require('./b');",
        "import('./missing');",
        "import external from 'gt-next';",
      ].join('\n')
    );
    const a = writeFile(path.join(dir, 'a.ts'), "export { value } from './c';");
    const b = writeFile(
      path.join(dir, 'b.js'),
      "module.exports = require('./c');"
    );
    const c = writeFile(path.join(dir, 'c.tsx'), 'export const value = 1;');

    const cache = createResolutionCache();
    const resolver = await createResolver(
      entry,
      createFilesystemResolver(),
      cache
    );

    expect(resolver('./a', entry)).toEqual({ id: a });
    expect(resolver('./b', entry)).toEqual({ id: b });
    expect(resolver('./missing', entry)).toBeNull();
    expect(resolver('gt-next', entry)).toBeNull();
    expect(resolver('./c', a)).toEqual({ id: c });
    expect(resolver('./c', b)).toEqual({ id: c });
  });

  it('waits for an in-flight graph build before returning concurrent resolvers', async () => {
    const dir = createTempDir();
    const entry = writeFile(path.join(dir, 'entry.ts'), "import './a';");
    const a = writeFile(path.join(dir, 'a.ts'), 'export const value = 1;');

    let releaseResolve: () => void = () => {};
    let startResolve: () => void = () => {};
    const release = new Promise<void>((resolve) => {
      releaseResolve = resolve;
    });
    const started = new Promise<void>((resolve) => {
      startResolve = resolve;
    });

    const nativeResolver: NativeResolver = async (source) => {
      startResolve();
      await release;
      return source === './a' ? { id: a } : null;
    };

    const cache = createResolutionCache();
    const firstResolverPromise = createResolver(entry, nativeResolver, cache);
    await started;

    let secondResolved = false;
    const secondResolverPromise = createResolver(
      entry,
      nativeResolver,
      cache
    ).then((resolver) => {
      secondResolved = true;
      return resolver;
    });

    await Promise.resolve();
    expect(secondResolved).toBe(false);

    releaseResolve();
    const secondResolver = await secondResolverPromise;
    const firstResolver = await firstResolverPromise;

    expect(firstResolver('./a', entry)).toEqual({ id: a });
    expect(secondResolver('./a', entry)).toEqual({ id: a });
  });

  it('does not deadlock concurrent root builds with circular imports', async () => {
    const dir = createTempDir();
    const fileA = writeFile(path.join(dir, 'a.ts'), "import './b';");
    const fileB = writeFile(path.join(dir, 'b.ts'), "import './a';");

    let releaseResolve: () => void = () => {};
    const release = new Promise<void>((resolve) => {
      releaseResolve = resolve;
    });

    const nativeResolver: NativeResolver = async (source) => {
      await release;
      if (source === './a') return { id: fileA };
      if (source === './b') return { id: fileB };
      return null;
    };

    const cache = createResolutionCache();
    const resolverAPromise = createResolver(fileA, nativeResolver, cache);
    const resolverBPromise = createResolver(fileB, nativeResolver, cache);

    releaseResolve();

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error('Timed out building graph')),
        1000
      );
    });
    const [resolverA, resolverB] = await Promise.race([
      Promise.all([resolverAPromise, resolverBPromise]),
      timeout,
    ]).finally(() => {
      if (timeoutId) clearTimeout(timeoutId);
    });

    expect(resolverA('./b', fileA)).toEqual({ id: fileB });
    expect(resolverB('./a', fileB)).toEqual({ id: fileA });
  });

  it('waits for shared pending transitive graphs before returning', async () => {
    const dir = createTempDir();
    const fileA = writeFile(path.join(dir, 'a.ts'), "import './shared';");
    const fileB = writeFile(path.join(dir, 'b.ts'), "import './shared';");
    const shared = writeFile(path.join(dir, 'shared.ts'), "import './leaf';");
    const leaf = writeFile(path.join(dir, 'leaf.ts'), 'export const leaf = 1;');

    let releaseResolve: () => void = () => {};
    const release = new Promise<void>((resolve) => {
      releaseResolve = resolve;
    });

    const nativeResolver: NativeResolver = async (source) => {
      await release;
      if (source === './shared') return { id: shared };
      if (source === './leaf') return { id: leaf };
      return null;
    };

    const cache = createResolutionCache();
    const resolverAPromise = createResolver(fileA, nativeResolver, cache);
    const resolverBPromise = createResolver(fileB, nativeResolver, cache);
    releaseResolve();

    const [resolverA, resolverB] = await Promise.all([
      resolverAPromise,
      resolverBPromise,
    ]);

    expect(resolverA('./shared', fileA)).toEqual({ id: shared });
    expect(resolverB('./shared', fileB)).toEqual({ id: shared });
    expect(resolverB('./leaf', shared)).toEqual({ id: leaf });
  });

  it('registers graph files with the provided watcher', async () => {
    const dir = createTempDir();
    const entry = writeFile(path.join(dir, 'entry.ts'), "import './a';");
    const a = writeFile(path.join(dir, 'a.ts'), 'export const value = 1;');
    const watched = new Set<string>();

    await createResolver(
      entry,
      createFilesystemResolver(),
      createResolutionCache(),
      (id) => watched.add(id)
    );

    expect(watched.has(entry)).toBe(true);
    expect(watched.has(a)).toBe(true);
  });
});
