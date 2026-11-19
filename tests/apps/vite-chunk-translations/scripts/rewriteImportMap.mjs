// Vite plugins for vite.config.ts, with CHECK_IMPORT_MAP=rewritten: an app
// whose own plugin has chunks import each other by a bare name, `r:<name>`,
// and rewrites the bundler's chunk import map for it in two steps. Before
// the compiler writes which translation files an import needs, the map has
// the name under the assets directory, next to Vite's own; once it has, the
// map has the bare name the chunks import by. The compiler's two hooks run
// on either side of the second step.
//
// Vite reads the chunks an import preloads from the import's specifier, and
// finds them for a name the map has under the assets directory by then: the
// imports of these builds are ones whose chunks Vite lists.

// The bundler's import map, and what starts the name of a chunk in it
const IMPORT_MAP = 'importmap.json';
const ASSETS = '/assets/';
const PREFIX = 'r:';

const readImports = (bundle) =>
  JSON.parse(String(bundle[IMPORT_MAP].source)).imports;

export function rewriteImportMap() {
  // The file of each chunk by its bare name, once the first step has run
  let bare;
  return [
    {
      name: 'check:rewrite-import-map',
      apply: 'build',
      enforce: 'post',
      // import('./Home-<hash>.js') becomes import('r:Home-<hash>.js')
      renderChunk: (code) => ({
        code: code.replace(
          /((?:\bfrom|\bimport)\s*\(?\s*["'`])\.\/([^"'`]+\.js)/g,
          `$1${PREFIX}$2`
        ),
        map: null,
      }),
      generateBundle: {
        order: 'pre',
        handler(_options, bundle) {
          if (bundle[IMPORT_MAP]?.type !== 'asset') return;
          const imports = readImports(bundle);
          bare = Object.fromEntries(
            Object.entries(imports)
              .filter(([name]) => name.startsWith(ASSETS))
              .map(([name, file]) => [PREFIX + name.slice(ASSETS.length), file])
          );
          const underAssets = Object.fromEntries(
            Object.entries(bare).map(([name, file]) => [ASSETS + name, file])
          );
          bundle[IMPORT_MAP].source = JSON.stringify({
            imports: { ...underAssets, ...imports },
          });
        },
      },
    },
    {
      name: 'check:rewrite-import-map:finish',
      apply: 'build',
      generateBundle: {
        order: 'post',
        handler(_options, bundle) {
          if (bundle[IMPORT_MAP]?.type !== 'asset' || !bare) return;
          // Vite's own names stay, for the chunks a page preloads
          const kept = Object.entries(readImports(bundle)).filter(
            ([name]) => !name.startsWith(ASSETS + PREFIX)
          );
          const source = JSON.stringify({
            imports: { ...bare, ...Object.fromEntries(kept) },
          });
          bundle[IMPORT_MAP].source = source;
          // The page holds a copy of the import map
          for (const file of Object.values(bundle)) {
            if (file.type === 'asset' && file.fileName.endsWith('.html')) {
              file.source = String(file.source).replace(
                /(<script type="importmap"[^>]*>)[\s\S]*?(<\/script>)/,
                (_match, open, close) => `${open}${source}${close}`
              );
            }
          }
        },
      },
    },
  ];
}
