import { vite as gtCompiler } from '@generaltranslation/compiler';
import { vite as gtCompilerRelease } from '@generaltranslation/compiler-release';

/**
 * Each build of the app. `generated` is the directory of src/generated it
 * builds, `init` the module of src/init that starts it, and `release` builds
 * against the published gt-react instead of the workspace's.
 */
export const variants = {
  // gt-react/unstable t with the compiler, which injects each hash.
  unstable: { generated: 'unstable', init: 'gt', compiler: gtCompiler },
  // One build per locale with the GT runtime left out: the compiler resolves
  // every message for the build's locale.
  static: {
    generated: 'unstable',
    init: 'gt',
    perLocale: true,
    compiler: (locale) =>
      gtCompiler({
        experimentalStaticLocale: locale,
        experimentalReplaceSource: true,
        experimentalStaticRuntime: true,
        files: {
          gt: {
            output: 'src/generated/unstable/_gt/[locale].json',
            inlineTranslations: { locales: [locale] },
          },
        },
      }),
  },
  // Without the compiler, t hashes each message when it renders, as it does
  // in a Next.js app: gt-next's SWC plugin injects no hash for these.
  'unstable-nohash': { generated: 'unstable', init: 'gt' },
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
