/**
 * Each build the load benchmark knows. `source` is the directory of the app's
 * `src` it builds (`gt`, or `hardcoded` for one build per locale), `init` the
 * module of `src/init` that starts it, `env` what the build runs with and
 * `compilerOptions` what the compiler's Vite plugin is given; a variant
 * without `compilerOptions` builds without the compiler.
 *
 * build.mjs takes all of them as flags too, so a build that differs by one
 * environment variable needs no entry here.
 */
export const variants = {
  // The best single build today: gt-react/unstable `t` with messages the
  // compiler precomputes, no ICU string parser, and the user's whole catalog
  // loaded before the app renders.
  baseline: {
    source: 'gt',
    init: 'catalog',
    env: { GT_OMIT_ICU_PARSER: '1' },
    compilerOptions: {},
  },
  // The baseline with a translation file per chunk and locale, which a user
  // of a translated locale fetches next to the chunk. The option is the
  // prototype's (#2869): without its packages this builds the baseline.
  sidecars: {
    source: 'gt',
    init: 'catalog',
    env: { GT_OMIT_ICU_PARSER: '1', GT_CHUNK_TRANSLATIONS: 'true' },
    compilerOptions: {},
  },
  // The same with each translation file named by a hash of its content, and
  // a map of the files per locale that a page loads first.
  'sidecars-map': {
    source: 'gt',
    init: 'catalog',
    env: {
      GT_OMIT_ICU_PARSER: '1',
      GT_CHUNK_TRANSLATIONS: 'true',
      GT_CHUNK_TRANSLATIONS_NAMING: 'map',
    },
    compilerOptions: {},
  },
  // The least a page can load: the app written in the user's language, with
  // no translation library. One build per locale, so not a single build.
  floor: { source: 'hardcoded', init: 'none', env: {} },
};

/**
 * Which requests of a page are translation files, as a regular expression on
 * the URL's path with `{locale}` for the page's locale: the catalog chunk of
 * a `baseline` build (named in vite.load.config.ts), or a JSON file named for
 * the locale next to a chunk, such as `route-a1b2.fr-CA.json`, with or
 * without a hash of its own after the locale.
 */
export const TRANSLATION_FILES =
  '(/catalog\\.{locale}-[^/]*\\.js|\\.{locale}(\\.[^./]+)?\\.json)$';

/** Latency in milliseconds / throughput in megabits per second. */
export const NETWORKS = ['20/50', '60/20', '150/5'];
