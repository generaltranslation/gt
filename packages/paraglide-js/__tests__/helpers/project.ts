import path from 'node:path/posix';
import {
  ModuleGraph,
  type GlobalBinding,
} from '../../src/compiler/analysis/module-graph.js';
import type { ParaglideUsage } from '../../src/compiler/analysis/types.js';
import { defaultLanguages } from '../../src/compiler/languages/index.js';
import {
  NO_PACKAGES,
  type LanguageContext,
  type ParseFailure,
  type SourceLanguage,
} from '../../src/compiler/languages/language.js';
import {
  defaultTargets,
  type ParaglideTarget,
} from '../../src/compiler/paraglide/targets.js';
import { projectPackages } from '../../src/compiler/project/packages.js';

export const ROOT = '/app';
/** The language tools installed in this repo (its devDependencies), as an app would have them. */
export const REPO_PACKAGES = projectPackages(
  path.resolve(import.meta.dirname, '../..')
);
export const OUTDIR = '/app/src/paraglide';
export const ENTRY = '/app/src/App.tsx';

/** Targets match by path, so the contents do not matter. */
const generated = Object.fromEntries(
  [
    'messages.js',
    'messages/_index.js',
    'messages/greeting.js',
    'messages/en.js',
    'runtime.js',
    'server.js',
    'registry.js',
  ].map((file) => [`${OUTDIR}/${file}`, 'export {}'])
);

export type AnalyzeOptions = {
  aliases?: Record<string, string>;
  targets?: readonly ParaglideTarget[];
  /** Directories that verify as outdirs. */
  outdirs?: string[];
  /** The analyzed file. Default: `ENTRY`. */
  entry?: string;
  /** Default: `defaultLanguages`. */
  languages?: readonly SourceLanguage[];
  globals?: readonly GlobalBinding[];
  /** Packages languages can load, e.g. framework compilers. Default: none. */
  context?: LanguageContext;
  /** Load every file first, as the collector does, not only those `entry` reaches. */
  loadAll?: boolean;
};

/** Analyzes `files[ENTRY]` in memory, with a resolver that mimics Vite's. */
export async function analyzeProject(
  files: Record<string, string>,
  options: AnalyzeOptions = {}
): Promise<ParaglideUsage[]> {
  const all = new Map(Object.entries({ ...generated, ...files }));
  const outdirs = options.outdirs ?? [OUTDIR];
  const skipped: string[] = [];

  const graph = await ModuleGraph.create({
    targets: options.targets ?? defaultTargets,
    languages: options.languages ?? defaultLanguages,
    packages: options.context ?? REPO_PACKAGES,
    isOutdir: async (directory) => outdirs.includes(directory),
    resolve: async (specifier, importer) =>
      resolveInMemory(specifier, importer, all, options.aliases),
    read: async (file) => all.get(file),
    onSkipped: (file, { error }) => void skipped.push(`${file}: ${error}`),
  });

  const entry = options.entry ?? ENTRY;
  const sources = options.loadAll ? Object.keys(files) : [entry];
  await graph.loadPaths(sources);
  graph.setGlobals(options.globals ?? []);

  // A test's code is meant to parse.
  const [failure] = skipped;
  if (failure !== undefined) throw new Error(failure);

  const analyzed = await graph.analyze([entry]);

  return analyzed.get(entry)?.usages ?? [];
}

/** Why the file `code` is not analyzed; undefined if it is. */
export async function skippedFile(
  file: string,
  code: string,
  languages: readonly SourceLanguage[],
  context: LanguageContext = NO_PACKAGES
): Promise<ParseFailure | undefined> {
  const failures: ParseFailure[] = [];

  const graph = await ModuleGraph.create({
    targets: defaultTargets,
    languages,
    packages: context,
    resolve: async () => undefined,
    read: async (path) => (path === file ? code : undefined),
    onSkipped: (_file, failure) => void failures.push(failure),
  });
  await graph.loadPaths([file]);

  return failures[0];
}

/** Aliases, relative and absolute paths, else a package; with the extensions a bundler tries. */
function resolveInMemory(
  specifier: string,
  importer: string,
  files: ReadonlyMap<string, string>,
  aliases: Record<string, string> = {}
): string | undefined {
  const base =
    aliasedPath(specifier, aliases) ?? unaliasedPath(specifier, importer);
  const candidates = [
    base,
    base.replace(/\.js$/, '.ts'),
    base.replace(/\.js$/, '.tsx'),
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}/index.ts`,
    `${base}/index.js`,
  ];

  return candidates.find((candidate) => files.has(candidate));
}

/** The last alias that matches wins. */
function aliasedPath(
  specifier: string,
  aliases: Record<string, string>
): string | undefined {
  let aliased: string | undefined;

  for (const [alias, target] of Object.entries(aliases)) {
    const isAliased = specifier === alias || specifier.startsWith(`${alias}/`);
    if (isAliased) aliased = target + specifier.slice(alias.length);
  }

  return aliased;
}

function unaliasedPath(specifier: string, importer: string): string {
  if (specifier.startsWith('.')) {
    return path.resolve(path.dirname(importer), specifier);
  }

  return specifier.startsWith('/')
    ? specifier
    : `${ROOT}/node_modules/${specifier}`;
}

/** e.g. `message:tos:method` */
export function summarize(usages: ParaglideUsage[]): string[] {
  return usages.map((usage) => `${usage.target}:${usage.name}:${usage.kind}`);
}

/** e.g. `message:greeting:call 3` */
export function describeUsages(usages: ParaglideUsage[]): string[] {
  return usages.map((usage) => `${summarize([usage])[0]} ${usage.line}`);
}

export async function analyzeEntry(
  code: string,
  others: Record<string, string> = {},
  options?: AnalyzeOptions
): Promise<string[]> {
  return summarize(await analyzeProject({ [ENTRY]: code, ...others }, options));
}
