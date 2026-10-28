import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, extname, relative, resolve } from 'node:path';
import { rm } from 'node:fs/promises';

import type { AttwOptions, Rolldown, UserConfig } from 'tsdown';

type UseClientBoundaryPluginOptions = {
  emittedSourceFiles?: string[] | 'all';
  name?: string;
  outDir?: string;
  outputExtension: string;
  root?: string;
};

type PackageCheckOptions = Pick<
  AttwOptions,
  'profile' | 'ignoreRules' | 'excludeEntrypoints'
>;

/**
 * Runs publint and arethetypeswrong on the packed tarball in CI and fails the
 * build on errors. tsdown checks a package once however many configs it has,
 * so the checks go on the first config.
 *
 * The default profile is node16 because no package supports node10
 * resolution. ESM-only packages use the esm-only profile.
 */
export function withPackageChecks(
  configs: UserConfig | UserConfig[],
  { profile = 'node16', ...attw }: PackageCheckOptions = {}
): UserConfig[] {
  const [first, ...rest] = [configs].flat();
  return [
    {
      ...first,
      publint: 'ci-only',
      attw: { enabled: 'ci-only', level: 'error', profile, ...attw },
    },
    ...rest,
  ];
}

/**
 * Emits a .d.mts stub for each ESM entry that re-exports the entry's
 * CJS-scoped .d.ts, instead of a second set of declarations. With two sets, an
 * ESM consumer that reaches the package both directly and through a
 * dependent's CJS-scoped declarations (gt-react-native reaching react-core)
 * sees two incompatible copies of each class.
 *
 * tsdown's dts.cjsReexport stubs the other direction (.d.cts re-exporting
 * .d.mts). TypeScript rejects that under node16 (TS1479) because CommonJS
 * cannot require ESM there.
 *
 * @param entries Output paths without extension, relative to the out dir.
 * @param overrides Stub source for entries that `export *` cannot cover.
 */
export function createEsmDeclarationStubsPlugin(
  entries: string[],
  overrides: Record<string, string> = {}
): Rolldown.Plugin {
  return {
    name: 'gt:esm-declaration-stubs',
    generateBundle() {
      for (const entry of entries) {
        this.emitFile({
          type: 'asset',
          fileName: `${entry}.d.mts`,
          source:
            overrides[entry] ?? `export * from './${basename(entry)}.js';\n`,
        });
      }
    },
  };
}

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
  | 'plugins'
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
  plugins,
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
    plugins,
  } satisfies UserConfig;
}

export function createUseClientBoundaryPlugin({
  emittedSourceFiles = 'all',
  name = 'gt:use-client-boundaries',
  outDir = 'dist',
  outputExtension,
  root = 'src',
}: UseClientBoundaryPluginOptions) {
  const cwd = process.cwd();
  const rootPath = resolve(cwd, root);
  const emitted =
    emittedSourceFiles === 'all'
      ? 'all'
      : new Set(emittedSourceFiles.map((file) => resolve(cwd, file)));

  return {
    name,
    resolveId(source: string, importer?: string) {
      if (!importer || !source.startsWith('.')) return null;

      const importerFile = importer.split('?')[0];
      if (hasUseClientDirective(importerFile)) return null;

      const targetFile = resolveSourceFile(source, importerFile);
      if (!targetFile || !hasUseClientDirective(targetFile)) return null;
      if (emitted !== 'all' && !emitted.has(targetFile)) return null;

      return {
        id: outputSpecifier({
          importerFile,
          outDir,
          outputExtension,
          rootPath,
          targetFile,
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
  const index = firstCodeIndex(code);
  return (
    code.startsWith("'use client'", index) ||
    code.startsWith('"use client"', index)
  );
}

function firstCodeIndex(code: string): number {
  let index = 0;
  while (index < code.length) {
    if (isWhitespace(code[index])) {
      index += 1;
      continue;
    }

    if (code.startsWith('//', index)) {
      const nextLine = code.indexOf('\n', index + 2);
      index = nextLine === -1 ? code.length : nextLine + 1;
      continue;
    }

    if (code.startsWith('/*', index)) {
      const commentEnd = code.indexOf('*/', index + 2);
      index = commentEnd === -1 ? code.length : commentEnd + 2;
      continue;
    }

    return index;
  }
  return index;
}

function isWhitespace(character: string): boolean {
  return /\s/.test(character);
}

function outputSpecifier({
  importerFile,
  outDir,
  outputExtension,
  rootPath,
  targetFile,
}: {
  importerFile: string;
  outDir: string;
  outputExtension: string;
  rootPath: string;
  targetFile: string;
}): string {
  const importerOutput = toOutputFile({
    outDir,
    outputExtension,
    rootPath,
    sourceFile: importerFile,
  });
  const targetOutput = toOutputFile({
    outDir,
    outputExtension,
    rootPath,
    sourceFile: targetFile,
  });
  const specifier = relative(dirname(importerOutput), targetOutput).replace(
    /\\/g,
    '/'
  );
  return specifier.startsWith('.') ? specifier : `./${specifier}`;
}

function toOutputFile({
  outDir,
  outputExtension,
  rootPath,
  sourceFile,
}: {
  outDir: string;
  outputExtension: string;
  rootPath: string;
  sourceFile: string;
}): string {
  const sourceRelative = relative(rootPath, sourceFile);
  return resolve(
    process.cwd(),
    outDir,
    `${sourceRelative.slice(0, -extname(sourceRelative).length)}${outputExtension}`
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

export function createRemoveRuntimeArtifactsHook(
  packageDir: string,
  outDir: string,
  artifactNames: string[]
) {
  const artifacts = artifactNames.map((name) =>
    resolve(packageDir, outDir, name)
  );

  return async () => {
    await Promise.all(
      artifacts.map((artifact) => rm(artifact, { force: true }))
    );
  };
}

function createRemoveTypeRuntimeArtifactsHook(
  outDir: string,
  typeEntry: string,
  packageDir: string
) {
  const typeEntryName = getEntryName(typeEntry);
  return createRemoveRuntimeArtifactsHook(packageDir, outDir, [
    `${typeEntryName}.cjs.min.cjs`,
    `${typeEntryName}.cjs.min.cjs.map`,
  ]);
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
