import path from 'node:path/posix';
import { parseSync } from 'oxc-parser';
import { expect } from 'vitest';
import { analyzeModule } from '../../src/compiler/analysis/analyze.js';
import {
  ModuleIndexer,
  summarizeModule,
} from '../../src/compiler/analysis/module-index.js';
import {
  ModuleGraph,
  type GlobalBinding,
  type ModuleGraphOptions,
  type ParsedModule,
} from '../../src/compiler/analysis/module-graph.js';
import type { ParaglideUsage } from '../../src/compiler/analysis/types.js';
import type { GeneratedModule } from '../../src/compiler/collector/module-reader.js';
import { defaultLanguages } from '../../src/compiler/languages/index.js';
import {
  generateSource,
  isSourceFile,
  parseSource,
  parseSourceSync,
  type LanguageContext,
  type ParseFunction,
  type SourceLanguage,
} from '../../src/compiler/languages/language.js';
import {
  defaultTargets,
  type ParaglideTarget,
} from '../../src/compiler/paraglide/targets.js';
import { projectPackages } from '../../src/compiler/project/packages.js';
import { parseModuleCode } from '../../src/compiler/utils/parse.js';
import { isDependency } from '../../src/compiler/utils/paths.js';

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

const parse: ParseFunction = (file, code, lang) =>
  parseSync(file, code, { lang, range: true, astType: 'ts' }) as never;

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
  /** Called each time the indexed analysis parses a module, which it does again once it unloads one. */
  onLoad?(file: string): void;
};

/** Analyzes `files[ENTRY]` in memory, with a resolver that mimics Vite's. */
export async function analyzeProject(
  files: Record<string, string>,
  options: AnalyzeOptions = {}
): Promise<ParaglideUsage[]> {
  const all = new Map(Object.entries({ ...generated, ...files }));
  const outdirs = options.outdirs ?? [OUTDIR];
  const languages = options.languages ?? defaultLanguages;
  const context = options.context ?? REPO_PACKAGES;

  const graphOptions = {
    targets: options.targets ?? defaultTargets,
    isOutdir: async (directory: string) => outdirs.includes(directory),
    globals: options.globals,
    shouldFollow: (file: string) =>
      isSourceFile(file, languages) && !isDependency(file),
    resolve: async (specifier: string, importer: string) =>
      resolveInMemory(specifier, importer, all, options.aliases),
    readModule: (file: string) => readInMemory(file, all, languages, context),
  };
  const graph = new ModuleGraph(graphOptions);

  const entry = options.entry ?? ENTRY;
  const sources = options.loadAll ? Object.keys(files) : [entry];
  await graph.loadPaths(sources);

  const usages = analyzeModule(graph, entry);

  // The collector indexes the modules and loads each when it is read: it must find the same.
  const indexed = await analyzeIndexed(graphOptions, all, sources, entry, {
    languages,
    context,
    onLoad: options.onLoad,
  });
  // The values a node holds come in the order their modules were loaded, which the index sets.
  expect(
    inCanonicalOrder(indexed),
    'usages found through an indexed graph'
  ).toEqual(inCanonicalOrder(usages));

  return usages;
}

function inCanonicalOrder(usages: readonly ParaglideUsage[]): ParaglideUsage[] {
  const key = (usage: ParaglideUsage) =>
    [
      usage.target,
      usage.targetFile,
      usage.name,
      usage.kind,
      usage.dynamic,
    ].join('\0');

  return [...usages].sort(
    (a, b) =>
      a.start - b.start ||
      a.end - b.end ||
      (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0)
  );
}

/**
 * Analyzes `entry` as the collector does: through an index of the modules,
 * with scripts parsed without ranges. Every other module is analyzed first,
 * with no module kept loaded after each, so that the entry's modules are
 * loaded again.
 */
async function analyzeIndexed(
  graphOptions: ModuleGraphOptions,
  files: ReadonlyMap<string, string>,
  sources: readonly string[],
  entry: string,
  {
    languages,
    context,
    onLoad,
  }: Pick<AnalyzeOptions, 'onLoad'> & {
    languages: readonly SourceLanguage[];
    context: LanguageContext;
  }
): Promise<ParaglideUsage[]> {
  const generatedModules = new Map<string, GeneratedModule>();
  const outdirGraph = new ModuleGraph(graphOptions);
  const indexer = new ModuleIndexer({
    graph: outdirGraph,
    resolve: graphOptions.resolve,
    summarize: async (file) => {
      const code = files.get(file);
      if (code === undefined) return undefined;

      const generatedModule = await generateSource(
        file,
        code,
        languages,
        context
      );
      if (generatedModule && 'error' in generatedModule) {
        throw new Error(`${file}: ${generatedModule.error}`);
      }

      const parsed = parseSourceSync(
        file,
        code,
        parseModuleCode,
        generatedModule
      );
      if ('error' in parsed) throw new Error(`${file}: ${parsed.error}`);
      if (generatedModule) generatedModules.set(file, generatedModule);

      return summarizeModule(
        parsed.module,
        new Set(graphOptions.globals?.map(({ name }) => name))
      );
    },
  });
  await indexer.indexPaths(sources);

  const graph = new ModuleGraph({
    targets: graphOptions.targets,
    outdirs: outdirGraph.outdirs,
    globals: graphOptions.globals,
    index: {
      summaries: indexer.modules,
      budget: 0,
      load: (file) => {
        onLoad?.(file);
        const parsed = parseSourceSync(
          file,
          files.get(file)!,
          parseModuleCode,
          generatedModules.get(file)
        );
        return 'module' in parsed ? parsed.module : undefined;
      },
    },
  });

  for (const { file } of indexer.modules) {
    if (file === entry) continue;

    analyzeModule(graph, file);
  }

  return analyzeModule(graph, entry);
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

/** Throws when the file does not parse: a test's code is meant to. */
async function readInMemory(
  file: string,
  files: ReadonlyMap<string, string>,
  languages: readonly SourceLanguage[],
  context: LanguageContext
): Promise<ParsedModule | undefined> {
  const code = files.get(file);
  if (code === undefined) return undefined;

  const parsed = await parseSource(file, code, parse, languages, context);
  if ('error' in parsed) throw new Error(`${file}: ${parsed.error}`);

  return parsed.module;
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
