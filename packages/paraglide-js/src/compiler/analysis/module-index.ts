import { specifierLinks, type SpecifierLinks } from './importers.js';
import type { ModuleGraph, ParsedModule } from './module-graph.js';
import type { ModuleSummary } from './module-store.js';
import { loadedSpecifiers } from './module-syntax.js';

/** What each module of a file loads and links: the file's module, then its scripts. */
export type ParsedSummary = Array<{
  specifiers: string[];
  links: SpecifierLinks;
}>;

export type ModuleIndexerOptions = {
  /** Detects outdirs and decides what to follow, as it does for `loadPaths`. */
  graph: Pick<ModuleGraph, 'detectOutdir' | 'shouldFollow'>;
  resolve(specifier: string, importer: string): Promise<string | undefined>;
  /** Reads a module; undefined if it cannot be read or parsed. */
  summarize(file: string): Promise<ParsedSummary | undefined>;
};

/** Reads what `ModuleGraph.linkModule` reads of a module: no syntax tree is kept. */
export function summarizeModule(parsed: ParsedModule): ParsedSummary {
  const { scripts = [], ...module } = parsed;

  return [module, ...scripts].map((part) => {
    const specifiers = loadedSpecifiers(part.program);
    for (const { specifier } of part.componentFields ?? []) {
      if (specifier !== '') specifiers.add(specifier);
    }

    return { specifiers: [...specifiers], links: specifierLinks(part.program) };
  });
}

/**
 * Finds the modules `ModuleGraph.loadPaths` would load, and what each loads,
 * without holding their syntax trees: an indexed graph loads them when it
 * reads them.
 */
export class ModuleIndexer {
  /** In loading order. */
  private readonly summaries = new Map<string, ModuleSummary>();
  private readonly indexing = new Map<
    string,
    Promise<ModuleSummary | undefined>
  >();

  constructor(private readonly options: ModuleIndexerOptions) {}

  /** In loading order. */
  get modules(): ModuleSummary[] {
    return [...this.summaries.values()];
  }

  has(file: string): boolean {
    return this.summaries.has(file);
  }

  /** Indexes `entries` and every module reachable from them. */
  async indexPaths(entries: readonly string[]): Promise<void> {
    const { graph } = this.options;
    const visited = new Set<string>();
    let frontier = [...new Set(entries)];

    while (frontier.length > 0) {
      for (const file of frontier) visited.add(file);

      const summaries = await Promise.all(
        frontier.map((file) => this.indexFile(file))
      );
      for (const summary of summaries) {
        if (summary) this.summaries.set(summary.file, summary);
      }

      const dependencies = dependenciesOf(summaries);

      // Outdirs must be known before deciding what is a target.
      await Promise.all(dependencies.map((file) => graph.detectOutdir(file)));

      frontier = dependencies.filter(
        (file) => !visited.has(file) && graph.shouldFollow(file)
      );
    }
  }

  private indexFile(file: string): Promise<ModuleSummary | undefined> {
    let indexing = this.indexing.get(file);

    if (!indexing) {
      indexing = this.readSummary(file);
      this.indexing.set(file, indexing);
    }

    return indexing;
  }

  private async readSummary(file: string): Promise<ModuleSummary | undefined> {
    const { summarize, resolve } = this.options;
    const parsed = await summarize(file);
    if (!parsed) return undefined;

    const parts = await Promise.all(
      parsed.map(async ({ specifiers, links }) => {
        const files = await Promise.all(
          specifiers.map((specifier) => resolve(specifier, file))
        );
        const resolved = specifiers.map(
          (specifier, index) => [specifier, files[index]] as const
        );

        return { resolved, links };
      })
    );

    return { file, parts };
  }
}

function dependenciesOf(
  summaries: ReadonlyArray<ModuleSummary | undefined>
): string[] {
  const dependencies = new Set<string>();

  for (const summary of summaries) {
    for (const { resolved } of summary?.parts ?? []) {
      for (const [, file] of resolved) {
        if (file) dependencies.add(file);
      }
    }
  }

  return [...dependencies];
}
