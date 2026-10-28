import { readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { describe, expect, it } from 'vitest';
import { getRuntimeImports, resolveRelative } from './utils/importGraph';

// Native code never imports the dictionary (compat) machinery, so apps that
// only use native APIs never ship it. Two checks:
// 1. Source: native runtime modules never reach a compat/ module or require
//    the dictionary aliases through relative imports.
// 2. Built output: bundling a native-only import from the published entries
//    tree-shakes every compat module away.

const packageRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const repoRoot = resolve(packageRoot, '../..');

// ===== Source graph ===== //

const nativeModules = [
  'packages/i18n/src/i18n-cache/I18nCache.ts',
  'packages/i18n/src/i18n-cache/singleton-operations.ts',
  'packages/i18n/src/translation-functions/internal/getGT.ts',
  'packages/i18n/src/translation-functions/internal/getMessages.ts',
  'packages/i18n/src/translation-functions/internal/tx.ts',
  'packages/react-core/src/i18n-store/I18nStore.ts',
  'packages/react-core/src/context/context.ts',
  'packages/react-core/src/context/InternalGTProvider.tsx',
  'packages/react-core/src/hooks/utils/missing-translation.ts',
  'packages/react-core/src/hooks/useGT.ts',
  'packages/react-core/src/hooks/useMessages.ts',
  'packages/react-core/src/setup/initializeGTSRA.ts',
  'packages/next/src/i18n-cache/NextI18nCache.ts',
  'packages/next/src/setup/initGT.ts',
  'packages/next/src/setup/initGT.server.ts',
  'packages/next/src/setup/initGT.client.ts',
  'packages/next/src/server-dir/buildtime/strings.ts',
  'packages/tanstack-start/src/internal/_config.ts',
  'packages/tanstack-start/src/functions/runtime.ts',
];

// Bundler aliases that resolve to the app's dictionary files.
const dictionarySpecifiers = [
  'gt-next/internal/_dictionary',
  'gt-next/internal/_load-dictionary',
  'gt-tanstack-start/internal/_compat-config',
];

function findCompatLeaks(): string[] {
  const leaks: string[] = [];
  const parents = new Map<string, string | null>();
  const queue = [...nativeModules];
  for (const file of nativeModules) parents.set(file, null);

  const chainTo = (file: string): string => {
    const chain = [file];
    let current = parents.get(file) ?? null;
    while (current) {
      chain.unshift(current);
      current = parents.get(current) ?? null;
    }
    return chain.join(' -> ');
  };

  while (queue.length > 0) {
    const file = queue.shift()!;
    const code = readFileSync(join(repoRoot, file), 'utf8');
    for (const specifier of getRuntimeImports(code)) {
      if (dictionarySpecifiers.includes(specifier)) {
        leaks.push(`${chainTo(file)} -> ${specifier}`);
        continue;
      }
      if (!specifier.startsWith('.')) continue;
      const resolved = resolveRelative(repoRoot, specifier, file);
      if (!resolved) continue;
      if (resolved.includes('/compat/')) {
        leaks.push(`${chainTo(file)} -> ${resolved}`);
        continue;
      }
      if (!parents.has(resolved)) {
        parents.set(resolved, file);
        queue.push(resolved);
      }
    }
  }
  return leaks;
}

// ===== Built output ===== //

// Strings that survive minification in the compat modules: singleton keys,
// log prefixes, error names and the dictionary alias specifiers.
const compatMarkers = [
  'dictionaryManager',
  'DictionaryManager: ',
  'DictionarySourceNotFoundError',
  'compatStore',
  'dictionaryContext',
  'Dictionary entry',
  'gt-next/internal/_dictionary',
  'gt-next/internal/_load-dictionary',
];

const external = [
  'react',
  'react/*',
  'react-dom',
  'react-dom/*',
  'next',
  'next/*',
  'server-only',
  // Request-function aliases resolved by the app's bundler.
  'gt-next/internal/*',
  ...builtinModules,
  ...builtinModules.map((name) => `node:${name}`),
];

async function bundle(
  contents: string,
  {
    conditions,
    platform,
  }: { conditions: string[]; platform: 'browser' | 'node' }
): Promise<{ code: string; inputs: string[] }> {
  const result = await build({
    stdin: { contents, resolveDir: packageRoot, loader: 'js' },
    bundle: true,
    write: false,
    format: 'esm',
    platform,
    conditions,
    external,
    metafile: true,
    logLevel: 'silent',
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  const [output] = Object.values(result.metafile.outputs);
  return {
    code: result.outputFiles[0].text,
    // Modules that contribute bytes after tree-shaking
    inputs: Object.entries(output.inputs)
      .filter(([, { bytesInOutput }]) => bytesInOutput > 0)
      .map(([input]) => input),
  };
}

function findMarkers(code: string): string[] {
  return compatMarkers.filter((marker) => code.includes(marker));
}

const nativeImports = 'T, useGT, useMessages, Var';

const nativeBundles = [
  {
    name: 'gt-react client',
    contents: `export { ${nativeImports} } from 'gt-react';`,
    conditions: ['browser'],
    platform: 'browser' as const,
  },
  {
    name: 'gt-next client',
    contents: `export { ${nativeImports} } from 'gt-next';`,
    conditions: ['browser'],
    platform: 'browser' as const,
  },
  {
    name: 'gt-next rsc',
    contents: `export { ${nativeImports} } from 'gt-next';`,
    conditions: ['react-server'],
    platform: 'node' as const,
  },
];

describe('gt compat leak enforcement', () => {
  it('native runtime modules never reach compat modules', () => {
    const leaks = findCompatLeaks();
    expect(leaks, leaks.join('\n')).toEqual([]);
  });

  it.each(nativeBundles)(
    '$name native-only bundle excludes compat modules',
    async ({ contents, conditions, platform }) => {
      const { code, inputs } = await bundle(contents, {
        conditions,
        platform,
      });

      expect(findMarkers(code)).toEqual([]);
      expect(inputs.filter((input) => /[\\/]compat[\\/]/.test(input))).toEqual(
        []
      );
    }
  );

  it('the markers detect compat modules when they are imported', async () => {
    const { code, inputs } = await bundle(
      `export { useTranslations } from 'gt-react';`,
      {
        conditions: ['browser'],
        platform: 'browser',
      }
    );

    expect(inputs.some((input) => /[\\/]compat[\\/]/.test(input))).toBe(true);
    expect(findMarkers(code)).toEqual(
      expect.arrayContaining([
        'dictionaryManager',
        'compatStore',
        'dictionaryContext',
        'Dictionary entry',
      ])
    );
  });
});
