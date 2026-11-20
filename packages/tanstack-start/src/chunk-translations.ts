/**
 * What the compiled code of a build with `experimentalSplitTranslations`
 * loads translations with. It is not written by hand: the compiler imports
 * it from this package, which every module of the app resolves, and not from
 * gt-react, which a strict install leaves out of the app's reach.
 */
export {
  loadChunk,
  loadMinifiedChunk,
  loadMappedChunk,
  loadMinifiedMappedChunk,
  loadRegionChunk,
  loadMinifiedRegionChunk,
} from 'gt-react/chunk-translations';
