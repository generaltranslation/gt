import path from 'node:path/posix';
import { parseSync } from 'oxc-parser';
import { analyzeModule } from '../../src/compiler/analysis/analyze.js';
import { defaultLanguages } from '../../src/compiler/languages/index.js';
import { isDependency } from '../../src/compiler/utils/paths.js';
import {
  isSourceFile,
  parseSource,
} from '../../src/compiler/languages/language.js';
import { projectPackages } from '../../src/compiler/project/packages.js';
import {
  ModuleGraph,
  type GlobalBinding,
} from '../../src/compiler/analysis/module-graph.js';
import type {
  LanguageContext,
  SourceLanguage,
} from '../../src/compiler/languages/language.js';
import {
  defaultTargets,
  packageTarget,
  type ParaglideTarget,
} from '../../src/compiler/paraglide/targets.js';
import type { ParaglideUsage } from '../../src/compiler/analysis/types.js';

export const ROOT = '/app';
/** The language tools installed in this repo (its devDependencies), as an app would have them. */
export const REPO_PACKAGES = projectPackages(
  path.resolve(import.meta.dirname, '../..')
);
export const OUTDIR = '/app/src/paraglide';
export const ENTRY = '/app/src/App.tsx';

/** A package of Paraglide components, e.g. `<ParaglideMessage />`, and its target. */
export const ADAPTER_FILES = {
  '/app/node_modules/paraglide-adapter/index.js': 'export {}',
};
export const ADAPTER_TARGETS = [
  ...defaultTargets,
  packageTarget('adapter', 'paraglide-adapter'),
];

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

/** Analyzes `files[ENTRY]` in memory, with a resolver that mimics Vite's. */
export async function analyzeProject(
  files: Record<string, string>,
  options: {
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
  } = {}
): Promise<ParaglideUsage[]> {
  const all = new Map(Object.entries({ ...generated, ...files }));
  const outdirs = options.outdirs ?? [OUTDIR];
  const languages = options.languages ?? defaultLanguages;
  const graph = new ModuleGraph({
    targets: options.targets ?? defaultTargets,
    isOutdir: async (directory) => outdirs.includes(directory),
    globals: options.globals,
    shouldFollow: (file) =>
      isSourceFile(file, languages) && !isDependency(file),
    async resolve(specifier, importer) {
      let base: string | undefined;
      for (const [alias, target] of Object.entries(options.aliases ?? {})) {
        if (specifier === alias || specifier.startsWith(`${alias}/`)) {
          base = target + specifier.slice(alias.length);
        }
      }
      base ??= specifier.startsWith('.')
        ? path.resolve(path.dirname(importer), specifier)
        : specifier.startsWith('/')
          ? specifier
          : `${ROOT}/node_modules/${specifier}`;
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
      return candidates.find((candidate) => all.has(candidate));
    },
    async readModule(file) {
      const code = all.get(file);
      if (code === undefined) return undefined;
      const parsed = await parseSource(
        file,
        code,
        (file, code, lang) =>
          parseSync(file, code, { lang, range: true, astType: 'ts' }) as never,
        languages,
        options.context ?? REPO_PACKAGES
      );
      if ('error' in parsed) throw new Error(`${file}: ${parsed.error}`);
      return parsed.module;
    },
  });
  const entry = options.entry ?? ENTRY;
  const sources = options.loadAll ? Object.keys(files) : [entry];
  await graph.loadPaths(sources);
  return analyzeModule({ graph, file: entry, root: ROOT });
}

/** e.g. `message:tos:method.parts` */
export function summarize(usages: ParaglideUsage[]): string[] {
  return usages.map(
    (usage) =>
      `${usage.target}:${usage.name}:${usage.kind}${usage.method ? `.${usage.method}` : ''}`
  );
}

/** e.g. ` <p title>`; empty for a usage outside an element. */
export function elementLabel({ element }: ParaglideUsage): string {
  if (!element) return '';

  const attribute = element.attribute ? ` ${element.attribute}` : '';

  return ` <${element.element}${attribute}>`;
}

/** e.g. `message:greeting:call 3 <p title>` */
export function describeUsages(usages: ParaglideUsage[]): string[] {
  return usages.map(
    (usage) => `${summarize([usage])[0]} ${usage.line}${elementLabel(usage)}`
  );
}

export async function analyzeEntry(
  code: string,
  others: Record<string, string> = {},
  options?: Parameters<typeof analyzeProject>[1]
): Promise<string[]> {
  return summarize(await analyzeProject({ [ENTRY]: code, ...others }, options));
}
