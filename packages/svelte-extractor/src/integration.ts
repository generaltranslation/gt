import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createDiagnosticMessage } from 'generaltranslation/internal';
import type { Updates } from 'generaltranslation/types';
import { analyzeSvelteSource } from './internal/source.js';
import type { SvelteParse } from './internal/types.js';

const GT_SVELTE_PACKAGE = 'gt-svelte';

/** Default `.svelte` sources when the project does not configure `src`. */
export const DEFAULT_SVELTE_SRC_PATTERNS = [
  'src/**/*.svelte',
  'app/**/*.svelte',
  'components/**/*.svelte',
];

const IGNORED_PATTERNS = [
  '**/node_modules/**',
  '**/.svelte-kit/**',
  '**/dist/**',
];

/** Extraction output shared with the host CLI. */
export type InlineExtractionOutput = {
  updates: Updates;
  errors: string[];
  warnings: string[];
};

/** Extractor for the host CLI's non-Svelte sources. */
export type PrimaryInlineExtractor = (
  filePatterns: string[] | undefined
) => Promise<InlineExtractionOutput>;

export type SvelteExtractionPlannerOptions = {
  /** Inline runtime selected by the host CLI. */
  library: string;
  /** Project root; `svelte/compiler` is resolved from here. */
  projectRoot: string;
  /** Explicit source patterns. `undefined` uses the defaults. */
  filePatterns?: string[];
};

export type SvelteExtractionPlan =
  | { readonly handled: false }
  | {
      readonly handled: true;
      run(options?: {
        extractPrimary?: PrimaryInlineExtractor;
      }): Promise<InlineExtractionOutput>;
    };

/**
 * Plans extraction for gt-svelte projects. Only an explicitly selected
 * `gt-svelte` runtime is handled; every other project is left untouched.
 */
export function planSvelteExtraction(
  options: SvelteExtractionPlannerOptions
): SvelteExtractionPlan {
  if (options.library !== GT_SVELTE_PACKAGE) return { handled: false };
  const projectRoot = path.resolve(options.projectRoot);
  return {
    handled: true,
    run: async ({ extractPrimary } = {}) => {
      const [primary, svelte] = await Promise.all([
        // Explicit patterns may match .svelte files the primary extractor
        // cannot parse, so exclude them from its share of the project.
        extractPrimary?.(
          options.filePatterns && [...options.filePatterns, '!**/*.svelte']
        ) ?? Promise.resolve({ updates: [], errors: [], warnings: [] }),
        extractFromSvelteProject(projectRoot, options.filePatterns),
      ]);
      return {
        updates: mergeUpdates(primary.updates, svelte.updates),
        errors: [...primary.errors, ...svelte.errors],
        warnings: [...primary.warnings, ...svelte.warnings],
      };
    },
  };
}

/** Extracts every `<T>` and string call from a project's `.svelte` files. */
export async function extractFromSvelteProject(
  projectRoot: string,
  filePatterns?: string[]
): Promise<InlineExtractionOutput> {
  const output: InlineExtractionOutput = {
    updates: [],
    errors: [],
    warnings: [],
  };
  const files = await findSvelteFiles(projectRoot, filePatterns);
  if (files.length === 0) return output;

  const parse = await loadSvelteParse(projectRoot);
  for (const file of files) {
    const relativePath = path.relative(projectRoot, file);
    const source = await fs.promises.readFile(file, 'utf8');
    let analysis;
    try {
      analysis = analyzeSvelteSource(source, { parse, filename: file });
    } catch (error) {
      output.errors.push(`${relativePath}: ${String(error)}`);
      continue;
    }
    for (const error of analysis.errors) {
      const message = error.fix
        ? `${error.whatHappened}. ${error.fix}.`
        : `${error.whatHappened}.`;
      output.errors.push(
        `${relativePath} (${error.location.line}:${error.location.column + 1}): ${message}`
      );
    }
    for (const site of analysis.translations) {
      output.updates.push({
        dataFormat: 'JSX',
        source: site.source,
        metadata: {
          ...site.metadata,
          hash: site.hash,
          filePaths: [relativePath],
        },
      } as Updates[number]);
    }
    for (const site of analysis.strings) {
      output.updates.push({
        dataFormat: 'ICU',
        source: site.source,
        metadata: {
          ...site.metadata,
          hash: site.hash,
          filePaths: [relativePath],
        },
      } as Updates[number]);
    }
  }
  output.updates = mergeUpdates([], output.updates);
  return output;
}

async function findSvelteFiles(
  projectRoot: string,
  filePatterns: string[] | undefined
): Promise<string[]> {
  const { default: fg } = await import('fast-glob');
  const files = await fg(filePatterns ?? DEFAULT_SVELTE_SRC_PATTERNS, {
    cwd: projectRoot,
    absolute: true,
    ignore: IGNORED_PATTERNS,
    onlyFiles: true,
  });
  return files.filter((file) => file.endsWith('.svelte')).sort();
}

/** Loads `parse` from the project's own Svelte compiler. */
async function loadSvelteParse(projectRoot: string): Promise<SvelteParse> {
  let compilerPath: string;
  try {
    compilerPath = createRequire(
      path.join(projectRoot, 'package.json')
    ).resolve('svelte/compiler');
  } catch {
    compilerPath = createRequire(import.meta.url).resolve('svelte/compiler');
  }
  // The `require` condition resolves Svelte's CommonJS build, whose exports
  // arrive on `default` when imported from ESM.
  const compiler = (await import(pathToFileURL(compilerPath).href)) as {
    parse?: SvelteParse;
    default?: { parse?: SvelteParse };
  };
  const parse = compiler.parse ?? compiler.default?.parse;
  if (!parse) {
    throw new Error(
      createDiagnosticMessage({
        source: '@generaltranslation/svelte-extractor',
        severity: 'Error',
        whatHappened: 'Could not load parse() from svelte/compiler',
        fix: 'Install svelte 5 in the project',
        details: compilerPath,
      })
    );
  }
  return parse;
}

/** Merges duplicate hashes, combining their file paths. */
function mergeUpdates(primary: Updates, incoming: Updates): Updates {
  const updates = [...primary];
  const byHash = new Map<string, number>();
  updates.forEach((update, index) => {
    if (update.metadata.hash) byHash.set(update.metadata.hash, index);
  });
  for (const update of incoming) {
    const hash = update.metadata.hash;
    const existingIndex = hash ? byHash.get(hash) : undefined;
    if (existingIndex === undefined) {
      if (hash) byHash.set(hash, updates.length);
      updates.push(update);
      continue;
    }
    const existing = updates[existingIndex];
    const filePaths = [
      ...new Set([
        ...(existing.metadata.filePaths ?? []),
        ...(update.metadata.filePaths ?? []),
      ]),
    ];
    updates[existingIndex] = {
      ...existing,
      metadata: { ...existing.metadata, filePaths },
    };
  }
  return updates;
}
