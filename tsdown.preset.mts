import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, extname, relative, resolve } from 'node:path';
import { rm } from 'node:fs/promises';

import type { UserConfig } from 'tsdown';

type UseClientBoundaryOptions = {
  emittedSourceFiles?: string[] | 'all';
  outDir?: string;
  outputExtension: string;
  root?: string;
};

type TsdownConfigOptions = {
  useClientBoundary?: Omit<UseClientBoundaryOptions, 'outputExtension'>;
};

export function createTsdownConfig(
  entry: string[],
  deps?: UserConfig['deps'],
  options: TsdownConfigOptions = {}
) {
  return [
    {
      entry,
      format: ['cjs'] as const,
      dts: true,
      sourcemap: true,
      clean: true,
      deps: { onlyBundle: false, ...deps },
      plugins: options.useClientBoundary
        ? [
            createUseClientBoundaryPlugin({
              ...options.useClientBoundary,
              outputExtension: '.cjs',
            }),
          ]
        : undefined,
    },
    {
      entry,
      format: ['esm'] as const,
      sourcemap: true,
      plugins: options.useClientBoundary
        ? [
            createUseClientBoundaryPlugin({
              ...options.useClientBoundary,
              outputExtension: '.mjs',
            }),
          ]
        : undefined,
    },
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
  | 'plugins'
  | 'root'
  | 'target'
  | 'tsconfig'
> & {
  entry?: UserConfig['entry'];
  format: 'cjs' | 'esm';
  useClientBoundary?: Omit<UseClientBoundaryOptions, 'outputExtension'> & {
    outputExtension?: string;
  };
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
  plugins,
  useClientBoundary,
}: TsdownUnbundleConfigOptions) {
  const outputExtension =
    useClientBoundary?.outputExtension ??
    outExtensions({ format } as Parameters<
      NonNullable<UserConfig['outExtensions']>
    >[0]).js;

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
    plugins: [
      ...(plugins ?? []),
      ...(useClientBoundary
        ? [
            createUseClientBoundaryPlugin({
              ...useClientBoundary,
              outputExtension,
              root,
            }),
          ]
        : []),
    ],
  } satisfies UserConfig;
}

function createUseClientBoundaryPlugin({
  emittedSourceFiles = 'all',
  outDir = 'dist',
  outputExtension,
  root = 'src',
}: UseClientBoundaryOptions) {
  const cwd = process.cwd();
  const rootAbsolute = resolve(cwd, root);
  const emitted =
    emittedSourceFiles === 'all'
      ? 'all'
      : new Set(emittedSourceFiles.map((file) => resolve(cwd, file)));

  return {
    name: 'gt:externalize-use-client-boundaries',
    resolveId(source: string, importer?: string) {
      if (!importer || !source.startsWith('.')) return null;

      const importerFile = stripQuery(importer);
      const importerAbsolute = resolve(importerFile);
      if (hasUseClientDirective(importerAbsolute)) return null;

      const resolved = resolveSourceFile(source, importerAbsolute);
      if (!resolved || !hasUseClientDirective(resolved)) return null;
      if (emitted !== 'all' && !emitted.has(resolved)) return null;

      return {
        id: getOutputSpecifier({
          fromSourceFile: importerAbsolute,
          outputExtension,
          rootAbsolute,
          targetSourceFile: resolved,
          outDir,
        }),
        external: true,
      };
    },
  };
}

function resolveSourceFile(source: string, importer: string): string | null {
  const base = resolve(dirname(importer), source);
  for (const suffix of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
    const candidate = base + suffix;
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function hasUseClientDirective(file: string): boolean {
  if (!existsSync(file)) return false;
  const code = readFileSync(file, 'utf8');
  return /^\s*(?:(?:\/\/[^\n]*|\/\*[\s\S]*?\*\/)\s*)*['"]use client['"];?/.test(
    code
  );
}

function stripQuery(file: string): string {
  return file.split('?')[0];
}

function getOutputSpecifier({
  fromSourceFile,
  outputExtension,
  rootAbsolute,
  targetSourceFile,
  outDir,
}: {
  fromSourceFile: string;
  outputExtension: string;
  rootAbsolute: string;
  targetSourceFile: string;
  outDir: string;
}) {
  const fromOutputFile = toOutputFile({
    file: fromSourceFile,
    outputExtension,
    rootAbsolute,
    outDir,
  });
  const targetOutputFile = toOutputFile({
    file: targetSourceFile,
    outputExtension,
    rootAbsolute,
    outDir,
  });
  const specifier = relative(dirname(fromOutputFile), targetOutputFile);
  return specifier.startsWith('.') ? specifier : `./${specifier}`;
}

function toOutputFile({
  file,
  outputExtension,
  rootAbsolute,
  outDir,
}: {
  file: string;
  outputExtension: string;
  rootAbsolute: string;
  outDir: string;
}) {
  const relativeSourceFile = relative(rootAbsolute, file);
  const parsedExtension = extname(relativeSourceFile);
  return resolve(
    process.cwd(),
    outDir,
    `${relativeSourceFile.slice(0, -parsedExtension.length)}${outputExtension}`
  );
}

type TsdownMinifiedDualFormatConfigOptions = Pick<
  UserConfig,
  'deps' | 'outDir'
> & {
  clean?: boolean;
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
  clean = true,
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
      clean: clean && index === 0,
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
