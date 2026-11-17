import { readFileSync } from 'node:fs';
import { vite as gtCompiler } from '@generaltranslation/compiler';
import { vite as gtCompilerRelease } from '@generaltranslation/compiler-release';

const gtConfig = JSON.parse(
  readFileSync(new URL('../gt.config.json', import.meta.url), 'utf8')
);

// The compiler embeds the translations it reads from the generated catalogs.
const embedded = (options = {}) =>
  gtCompiler({
    ...options,
    gtConfig: {
      ...gtConfig,
      files: {
        gt: {
          output: 'src/generated/unstable/_gt/[locale].json',
          inlineTranslations: { locales: gtConfig.locales },
        },
      },
    },
  });

/**
 * Each build of the app. `generated` is the directory of src/generated it
 * builds, `init` the module of src/init that starts it, and `release` builds
 * against the published gt-react instead of the workspace's. A `perLocale`
 * variant is built once per measured locale, with GT_STATIC_LOCALE set, and
 * `env` adds to that build's environment.
 */
export const variants = {
  // gt-react/unstable t with the compiler, which precomputes each message.
  unstable: { generated: 'unstable', init: 'gt', compiler: gtCompiler },
  // The compiler's hashes without its precomputed messages: t builds each
  // call site's tree when it first renders.
  'unstable-templates': {
    generated: 'unstable',
    init: 'gt',
    compiler: () => gtCompiler({ precomputeMessages: false }),
  },
  // Without the compiler, t hashes each message when it renders, as it does
  // in a Next.js app: gt-next's SWC plugin injects no hash for these.
  'unstable-nohash': { generated: 'unstable', init: 'gt' },
  // One build that embeds every locale's translations at the call sites; the
  // catalogs loaded at runtime hold only what the compiler does not embed.
  inline: { generated: 'unstable', init: 'gt-msg', compiler: embedded },
  // One build per locale, which embeds that locale's translations.
  'per-locale': {
    generated: 'unstable',
    init: 'gt-msg',
    compiler: embedded,
    perLocale: true,
  },
  // One build per locale, whose embedded call sites hold the translation in
  // place of the source.
  replaced: {
    generated: 'unstable',
    init: 'gt-msg',
    compiler: embedded,
    perLocale: true,
    env: { GT_REPLACE_SOURCE: 'true' },
  },
  'replaced-templates': {
    generated: 'unstable',
    init: 'gt-msg',
    compiler: () => embedded({ precomputeMessages: false }),
    perLocale: true,
    env: { GT_REPLACE_SOURCE: 'true' },
  },
  // useGT() and <T> of the published gt-react.
  stable: {
    generated: 'stable',
    init: 'gt',
    compiler: gtCompilerRelease,
    release: true,
  },
  // Precomputed strings: the least a render can cost.
  floor: { generated: 'floor', init: 'floor' },
};
