import path from 'node:path';
import { defaultInlineManifestPath } from 'generaltranslation/internal';
import type { Plugin } from 'vite';
import { packageName } from '../shared/protocol.js';
import type { AnyNode } from './ast.js';
import { prepareSvelteComponent } from './component.js';
import { SourceCompiler } from './compiler.js';
import { compileModule } from './module.js';
import { ManifestCollector } from './manifest.js';

export type { ManifestEntry, ManifestMetadata } from './manifest.js';

export type GTSveltePluginOptions = {
  /**
   * Where `vite build` writes the translation manifest the gt CLI uploads,
   * relative to the Vite root. `false` disables writing it.
   */
  manifest?: string | false;
};

const moduleExtensions = /\.(?:[cm]?[jt]s)$/;

type ResolveContext = {
  resolve(
    source: string,
    importer?: string,
    options?: { skipSelf?: boolean }
  ): Promise<{ id: string } | null>;
};

/**
 * Compiles `gt()` calls and `<T>` content at build time and writes the
 * manifest of translatable entries. Place it before `svelte()`.
 */
export function gtSvelte(options: GTSveltePluginOptions = {}): Plugin[] {
  const manifestOption = options.manifest ?? defaultInlineManifestPath;
  const collector = new ManifestCollector();
  let root = process.cwd();
  let isBuild = false;
  let runtimeId: Promise<string | undefined> | undefined;

  const relative = (file: string) =>
    path.relative(root, file).split(path.sep).join('/');

  /** Import sources that resolve to the gt-svelte runtime entry. */
  async function runtimeSources(
    context: ResolveContext,
    sources: string[],
    importer: string
  ): Promise<Set<string>> {
    const runtime = new Set<string>();
    for (const source of new Set(sources)) {
      if (source === packageName) {
        runtime.add(source);
        continue;
      }
      if (/^[./]/.test(source) || source.includes(':')) continue;
      runtimeId ??= context
        .resolve(packageName, importer, { skipSelf: true })
        .then((resolved) => resolved?.id);
      const expected = await runtimeId;
      if (!expected) continue;
      const resolved = await context.resolve(source, importer, {
        skipSelf: true,
      });
      if (resolved?.id === expected) runtime.add(source);
    }
    return runtime;
  }

  const components: Plugin = {
    name: 'gt-svelte:components',
    enforce: 'pre',
    configResolved(config) {
      root = config.root;
      isBuild = config.command === 'build';
    },
    async transform(code, id) {
      const file = sourceFile(id);
      if (!file?.endsWith('.svelte')) return null;
      const prepared = prepareSvelteComponent(code, file, relative(file));
      const sources = await runtimeSources(this, prepared.importSources, file);
      const result = sources.size ? prepared.compile(sources) : null;
      collector.set(file, result?.entries ?? []);
      return result && { code: result.code, map: result.map };
    },
    async buildEnd(error) {
      if (!isBuild || error || manifestOption === false) return;
      await collector.write(path.resolve(root, manifestOption));
    },
  };

  const modules: Plugin = {
    name: 'gt-svelte:modules',
    async transform(code, id) {
      const file = sourceFile(id);
      if (!file || !moduleExtensions.test(file)) return null;
      const program = this.parse(code) as unknown as AnyNode;
      const imports = SourceCompiler.importSources(program);
      const sources = imports.length
        ? await runtimeSources(this, imports, file)
        : new Set<string>();
      const result = sources.size
        ? compileModule(code, program, file, relative(file), sources)
        : null;
      collector.set(file, result?.entries ?? []);
      return result && { code: result.code, map: result.map };
    },
  };

  return [components, modules];
}

/** The file behind a module id, or `undefined` for virtual and dependency modules. */
function sourceFile(id: string): string | undefined {
  if (id.startsWith('\0') || id.includes('?')) return undefined;
  if (id.includes('/node_modules/')) return undefined;
  return id;
}
