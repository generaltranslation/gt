import { existsSync } from 'node:fs';
import { basename, extname, resolve } from 'node:path';
import { rm } from 'node:fs/promises';

import type { UserConfig } from 'tsdown';

export function createTsdownConfig(entry: string[], deps?: UserConfig['deps']) {
  return [
    {
      entry,
      format: ['cjs'] as const,
      dts: true,
      sourcemap: true,
      clean: true,
      deps: { onlyBundle: false, ...deps },
    },
    { entry, format: ['esm'] as const, sourcemap: true },
  ];
}

type TsdownUnbundleConfigOptions = Pick<
  UserConfig,
  | 'clean'
  | 'cjsDefault'
  | 'copy'
  | 'deps'
  | 'dts'
  | 'outDir'
  | 'outExtensions'
  | 'outputOptions'
  | 'platform'
  | 'root'
  | 'target'
  | 'tsconfig'
> & {
  entry?: UserConfig['entry'];
  format: 'cjs' | 'esm';
};

export function createTsdownUnbundleConfig({
  entry = [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/**/__mocks__/**',
    '!src/**/*.test.{ts,tsx}',
  ],
  format,
  deps,
  outDir,
  root = 'src',
  tsconfig,
  dts = false,
  clean = true,
  copy,
  platform,
  target,
  cjsDefault,
  outExtensions = () => ({ js: '.js', dts: '.d.ts' }),
  outputOptions,
}: TsdownUnbundleConfigOptions) {
  return {
    entry,
    format: [format],
    dts,
    sourcemap: true,
    clean,
    unbundle: true,
    root,
    outDir,
    tsconfig,
    copy,
    platform,
    target,
    cjsDefault,
    hash: false,
    // Keep unbundled builds tsc-like; do not inline pnpm store packages.
    deps: { skipNodeModulesBundle: true, onlyBundle: false, ...deps },
    outExtensions,
    outputOptions,
  } satisfies UserConfig;
}

type TsdownMinifiedDualFormatConfigOptions = Pick<
  UserConfig,
  'deps' | 'outDir'
> & {
  entries: string[];
  packageDir?: string;
  /** Defaults to the conventional type entry when it exists. Pass false to skip the types-only CJS artifact. */
  typeEntry?: string | false;
};

const defaultTypeEntry = 'src/types.ts';

const minifiedOutExtensions: UserConfig['outExtensions'] = ({ format }) => ({
  js: format === 'cjs' ? '.cjs.min.cjs' : '.esm.min.mjs',
  dts: '.d.ts',
});

function getEntryName(entry: string) {
  return basename(entry, extname(entry));
}

function createRemoveTypeRuntimeArtifactsHook(
  outDir: string,
  typeEntry: string,
  packageDir: string
) {
  const typeEntryName = getEntryName(typeEntry);
  const artifacts = [
    resolve(packageDir, outDir, `${typeEntryName}.cjs.min.cjs`),
    resolve(packageDir, outDir, `${typeEntryName}.cjs.min.cjs.map`),
  ];

  return async () => {
    await Promise.all(
      artifacts.map((artifact) => rm(artifact, { force: true }))
    );
  };
}

export function createTsdownMinifiedDualFormatConfig({
  entries,
  packageDir = process.cwd(),
  typeEntry,
  deps,
  outDir = 'dist',
}: TsdownMinifiedDualFormatConfigOptions) {
  const resolvedTypeEntry =
    typeEntry ??
    (existsSync(resolve(packageDir, defaultTypeEntry))
      ? defaultTypeEntry
      : false);

  const outputOptions = {
    outDir,
    sourcemap: true,
    minify: true,
    deps: { onlyBundle: false, ...deps },
    outExtensions: minifiedOutExtensions,
  } satisfies UserConfig;

  const configs: UserConfig[] = entries.flatMap((entry, index) => [
    {
      ...outputOptions,
      entry: [entry],
      format: ['cjs'] as const,
      dts: true,
      clean: index === 0,
    },
    {
      ...outputOptions,
      entry: [entry],
      format: ['esm'] as const,
    },
  ]);

  if (resolvedTypeEntry) {
    configs.push({
      ...outputOptions,
      entry: [resolvedTypeEntry],
      format: ['cjs'] as const,
      dts: true,
      clean: false,
      onSuccess: createRemoveTypeRuntimeArtifactsHook(
        outDir,
        resolvedTypeEntry,
        packageDir
      ),
    });
  }

  return configs;
}
