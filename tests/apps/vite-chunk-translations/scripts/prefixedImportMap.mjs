// Vite plugins for CHECK_IMPORT_MAP=prefixed and CHECK_IMPORT_MAP=rewritten:
// a build with Vite's chunk import map (`build.chunkImportMap`) whose chunks
// import each other by a specifier that is not a path. Where Vite writes
// `./Home-<hash>.js` and maps `/assets/Home-<hash>.js`, this build writes and
// maps `r:Home-<hash>.js`, so only the page's import map says where a chunk
// is. Vite's preload lists keep the names Vite gives a chunk
// (`assets/Home-<hash>.js`), which the import map then no longer has, and
// Vite's preload helper resolves them as the chunks import each other.
//
// `prefixed` renames the keys of the import map before the compiler reads
// it. `rewritten` does it in two steps, on either side of the compiler's
// first hook: the import map has the prefixed specifier under the assets
// directory, next to Vite's own names, as the compiler writes which
// translation files an import needs, and the specifier as the chunks import
// by it only afterwards, before the compiler's second hook.
const PREFIX = 'r:';
// What `./` is in a chunk's code, which the prefix replaces at the same length
const RELATIVE = './';
const IMPORT_MAP = 'importmap.json';
const PRELOAD_HELPER = '\0vite/preload-helper.js';
// How Vite's preload helper makes the URL of a chunk it lists
const LISTED_URL = 'assetsURL(depString, importerUrl)';

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** @param {{ late?: boolean }} [options] `late`: the second way above. */
export function prefixedImportMap({ late = false } = {}) {
  let assetsDir;
  let base;
  // The chunks an import preloads, as Vite lists them. Vite reads them from
  // the import's specifier, joined to the importing chunk's directory, and
  // finds no chunk by a prefixed one.
  let listPreloaded = () => undefined;
  // The import map as the chunks import each other, once the first step has run
  let prefixed;
  const prefix = {
    name: 'prefixed-import-map',
    // Before the compiler, which reads the import map as it writes the
    // translation files
    enforce: 'pre',
    config: (config) =>
      config.build?.modulePreload === false
        ? undefined
        : {
            build: {
              modulePreload: {
                resolveDependencies: (imported, deps, { hostId }) =>
                  listPreloaded(imported, hostId) ?? deps,
              },
            },
          },
    configResolved(config) {
      assetsDir = `${config.build.assetsDir}/`;
      base = config.base;
    },
    // A chunk Vite lists is resolved as the chunks import it: by its name
    // without the directory, through the import map
    transform(code, id) {
      if (id !== PRELOAD_HELPER) return null;
      if (!code.includes(LISTED_URL)) {
        throw new Error("Vite's preload helper is not as this plugin reads it");
      }
      return code.replace(
        LISTED_URL,
        `(depString.startsWith(${JSON.stringify(assetsDir)}) && /\\.(?:js|css)$/.test(depString) ? ${JSON.stringify(PREFIX)} + depString.slice(${assetsDir.length}) : ${LISTED_URL})`
      );
    },
    // Every chunk is in the assets directory, so each imports another by
    // `./` and its name
    renderChunk: {
      order: 'post',
      handler(code, _chunk, _options, { chunks }) {
        const names = Object.keys(chunks)
          .filter((file) => file.startsWith(assetsDir))
          .map((file) => escape(file.slice(assetsDir.length)));
        if (!names.length) return null;
        const renamed = code.replace(
          new RegExp(`(["'\`])${escape(RELATIVE)}(${names.join('|')})\\1`, 'g'),
          (_match, quote, name) => `${quote}${PREFIX}${name}${quote}`
        );
        return renamed === code ? null : { code: renamed, map: null };
      },
    },
    // The import map names each chunk as the chunks now import it. The page
    // holds a copy, which Vite writes from this one.
    generateBundle(_options, bundle) {
      const asset = bundle[IMPORT_MAP];
      if (asset?.type !== 'asset') return;
      const content = JSON.parse(asset.source);
      const fileOf = new Map(
        Object.entries(content.imports).map(([name, file]) => [
          name.slice(base.length),
          file.slice(base.length),
        ])
      );
      const nameOf = new Map([...fileOf].map(([name, file]) => [file, name]));
      listPreloaded = (imported, importer) => {
        if (!imported.startsWith(assetsDir + PREFIX)) return undefined;
        const listed = [];
        const seen = new Set([importer]);
        const visit = (chunk) => {
          const file = fileOf.get(chunk) ?? chunk;
          if (seen.has(file) || bundle[file]?.type !== 'chunk') return;
          seen.add(file);
          listed.push(nameOf.get(file) ?? file);
          bundle[file].imports.forEach(visit);
        };
        visit(assetsDir + imported.slice(assetsDir.length + PREFIX.length));
        return listed.length > 1 ? listed : [];
      };
      const isChunk = (name) => name.startsWith(base + assetsDir);
      const rename = (name) =>
        isChunk(name)
          ? PREFIX + name.slice(base.length + assetsDir.length)
          : name;
      prefixed = {
        ...content,
        imports: Object.fromEntries(
          Object.entries(content.imports).map(([name, file]) => [
            rename(name),
            file,
          ])
        ),
      };
      asset.source = JSON.stringify(
        late
          ? {
              ...content,
              // Under the assets directory, next to Vite's own names
              imports: {
                ...Object.fromEntries(
                  Object.entries(content.imports)
                    .filter(([name]) => isChunk(name))
                    .map(([name, file]) => [
                      base + assetsDir + rename(name),
                      file,
                    ])
                ),
                ...content.imports,
              },
            }
          : prefixed
      );
    },
  };
  if (!late) return [prefix];
  return [
    prefix,
    {
      name: 'prefixed-import-map:finish',
      // After the compiler has written which translation files an import
      // needs, and before it names the chunk at each import
      generateBundle: {
        order: 'post',
        handler(_options, bundle) {
          const asset = bundle[IMPORT_MAP];
          if (asset?.type !== 'asset' || !prefixed) return;
          // What Vite has written into the import map since stays
          const written = JSON.parse(asset.source).imports;
          const source = JSON.stringify({
            ...prefixed,
            imports: {
              ...prefixed.imports,
              ...Object.fromEntries(
                Object.entries(written).filter(
                  ([name]) =>
                    !(name.startsWith(base + assetsDir) && name.endsWith('.js'))
                )
              ),
            },
          });
          asset.source = source;
          // The page's copy was written from the import map as it was
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
