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
  // The least a page can load: the app written in the user's language, with
  // no translation library. One build per locale, so not a single build.
  floor: { source: 'hardcoded', init: 'none', env: {} },
};

/**
 * Which requests of a page are translation files, as a regular expression on
 * the URL's path with `{locale}` for the page's locale: the catalog chunk of
 * a `baseline` build (named in vite.load.config.ts), or a JSON file named for
 * the locale next to a chunk, such as `route-a1b2.fr-CA.json`.
 */
export const TRANSLATION_FILES =
  '(/catalog\\.{locale}-[^/]*\\.js|\\.{locale}\\.json)$';

/** Latency in milliseconds / throughput in megabits per second. */
export const NETWORKS = ['20/50', '60/20', '150/5'];
