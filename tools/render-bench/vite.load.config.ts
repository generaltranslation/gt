// Builds an app of scripts/load/generate.mjs as scripts/load/build.mjs asks,
// from the app's directory.
import { writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { vite as gtCompiler } from '@generaltranslation/compiler';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

type LoadBuild = {
  source: string;
  init: string;
  compilerOptions?: Parameters<typeof gtCompiler>[0];
  outDir: string;
  graph: string;
};

if (!process.env.BENCH_LOAD_BUILD) {
  throw new Error('Run this build through scripts/load/build.mjs');
}
const build: LoadBuild = JSON.parse(process.env.BENCH_LOAD_BUILD);
const root = process.cwd();
// A message's hash: 16 hexadecimal digits.
const HASHES = /(?<![0-9a-f])[0-9a-f]{16}(?![0-9a-f])/g;

/**
 * Writes which modules each chunk holds, what each module imports and the
 * message hashes in it, next to the build: scripts/load/distribution.mjs
 * reads from it what a route reaches module by module, which the chunks alone
 * do not say.
 */
function moduleGraph(file: string): Plugin {
  const hashes = new Map<string, string[]>();
  return {
    name: 'gt-load-bench:module-graph',
    enforce: 'post',
    // After the compiler, which writes each message's hash at its call site.
    transform(code, id) {
      if (id.startsWith(join(root, 'src'))) {
        hashes.set(id, [...new Set(code.match(HASHES))]);
      }
    },
    generateBundle(_options, bundle) {
      const name = (id: string) => relative(root, id);
      const chunks = Object.values(bundle).filter(
        (output) => output.type === 'chunk'
      );
      writeFileSync(
        file,
        JSON.stringify({
          chunks: Object.fromEntries(
            chunks.map((chunk) => [
              chunk.fileName,
              {
                entry: chunk.isEntry,
                facade: chunk.facadeModuleId && name(chunk.facadeModuleId),
                modules: chunk.moduleIds.map(name),
              },
            ])
          ),
          modules: Object.fromEntries(
            chunks.flatMap((chunk) =>
              chunk.moduleIds.map((id) => {
                const info = this.getModuleInfo(id);
                return [
                  name(id),
                  {
                    imports: info?.importedIds.map(name) ?? [],
                    dynamicImports:
                      info?.dynamicallyImportedIds.map(name) ?? [],
                    hashes: hashes.get(id) ?? [],
                  },
                ];
              })
            )
          ),
        })
      );
    },
  };
}

export default defineConfig({
  root,
  plugins: [
    build.compilerOptions ? gtCompiler(build.compilerOptions) : undefined,
    react(),
    moduleGraph(build.graph),
  ],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: [
      { find: '@source', replacement: join(root, 'src', build.source) },
      {
        find: '@init',
        replacement: join(root, 'src', 'init', `${build.init}.js`),
      },
    ],
  },
  // A catalog as one JSON.parse() of a string, which is smaller and parses
  // faster than Vite's default of an export per key.
  json: { namedExports: false, stringify: true },
  build: {
    outDir: build.outDir,
    emptyOutDir: true,
    // A whole catalog is one chunk.
    chunkSizeWarningLimit: Infinity,
    rollupOptions: {
      output: {
        // A catalog's chunk says so in its name, so a network log shows which
        // requests were translations.
        chunkFileNames: (chunk) =>
          chunk.facadeModuleId?.includes('/src/_gt/')
            ? 'assets/catalog.[name]-[hash].js'
            : 'assets/[name]-[hash].js',
        // The `app` shape's pool of shared modules, in the chunks its
        // directories name: a bundler packs what many chunks import. Without
        // what they import, or React would move into the first of them.
        codeSplitting: {
          includeDependenciesRecursively: false,
          groups: [
            {
              debugName: 'pool',
              name: (id) => {
                const chunk = /\/pool\/(c\d+)\//.exec(id)?.[1];
                return chunk ? `pool-${chunk}` : null;
              },
            },
          ],
        },
      },
    },
  },
});
