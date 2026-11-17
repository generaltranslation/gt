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
  // The same with a translation file per chunk and locale, which a route's
  // import fetches with the route. The option is the prototype's (#2869):
  // without its packages this is `unstable`.
  sidecars: {
    generated: 'unstable',
    init: 'gt',
    compiler: () =>
      gtCompiler({
        experimentalChunkTranslations: true,
        files: { gt: { output: 'src/generated/unstable/_gt/[locale].json' } },
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
