// Redirected by the gt-tanstack-start Vite plugin to splitTranslations.server
// or splitTranslations.client in a production build that splits translations.
// Otherwise the split is off and apps ship none of its code.
import type { ChunkTranslationsSeed } from 'gt-react/chunk-translations';

/** What the server reads of a router to find the client chunks of the matched routes. */
export type SplitRouter = {
  state?: { matches?: readonly { routeId: string }[] };
  ssr?: {
    manifest?: {
      routes?: Record<
        string,
        { preloads?: readonly (string | { href: string })[] } | undefined
      >;
    };
  };
};

/** On the server: what a page rendered for a request hydrates with. */
export const createSplitSeed: (
  router: SplitRouter,
  locale: string,
  translations: Record<string, unknown> | undefined
) => ChunkTranslationsSeed | undefined = () => undefined;

/** On the server: what a prerendered shell, which every visitor gets, starts with. */
export const createSplitShellSeed: (
  router: SplitRouter
) => ChunkTranslationsSeed | undefined = () => undefined;

/** In the browser: resolves once the page can hydrate. */
export const seedSplit: (
  seed: ChunkTranslationsSeed
) => Promise<void> = async () => undefined;

/** In the browser: what loads a locale in place of the app's loader. */
export const loadSplitTranslations:
  | ((locale: string) => Promise<Record<string, unknown>>)
  | undefined = undefined;
