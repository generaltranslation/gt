/**
 * The server's side of a build made with the compiler's experimental
 * `experimentalSplitTranslations` option, for a framework that renders pages
 * on a server. The server renders from whole catalogs, as without the split;
 * these only say what a page gets to hydrate with. The page gives what they
 * return to `seedChunkTranslations()` from `gt-react/chunk-translations`.
 *
 * Nothing here reads a translations file of the build, so nothing depends on
 * how the build lays one out: the translations are the server's own.
 */
export {
  createChunkTranslationsSeed,
  createChunkTranslationsShellSeed,
} from './chunk-translations/server';
