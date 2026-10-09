import type { ComponentType, ReactNode } from 'react';
import type { SharedGTProviderProps } from 'gt-react';

/** GT state shuttled from the server render to client hydration. */
export type GTRouterState = {
  locale: string;
  region?: string;
  enableI18n: boolean;
  translations: SharedGTProviderProps['translations'];
  dictionaries: NonNullable<SharedGTProviderProps['dictionaries']>;
};

export type GTDehydratedRouterData =
  | {
      gt?: GTRouterState & {
        /** Rendered into a prerendered SPA shell served to every visitor. */
        shell?: boolean;
      };
    }
  | undefined;

/** Matches TanStack Router's LocationRewriteFunction. */
export type GTLocationRewriteFunction = (options: {
  url: URL;
}) => URL | string | undefined;

/** Matches TanStack Router's LocationRewrite. */
export type GTLocationRewrite = {
  input?: GTLocationRewriteFunction;
  output?: GTLocationRewriteFunction;
};

/**
 * The router options GT wires into. Structural, so it accepts any TanStack
 * Router version the app installs.
 */
export type GTRouterOptions = {
  dehydrate?: () => unknown;
  // oxlint-disable-next-line typescript/no-explicit-any -- matches the app's Register-typed hydrate
  hydrate?: (dehydrated: any) => unknown;
  Wrap?: ComponentType<{ children: ReactNode }>;
  rewrite?: GTLocationRewrite;
};

export type GTIntegrableRouter = {
  options: GTRouterOptions;
  // Method syntax keeps the parameter bivariant, so the app's fully typed
  // router.update() is accepted.
  update(options: Partial<GTRouterOptions>): void;
  /** True while Start renders a prerendered SPA shell (Router >= 1.159). */
  isShell?: () => boolean;
};

export type SetupRouterGTIntegrationOptions = {
  router: GTIntegrableRouter;
  /**
   * Pass false to keep GT from rewriting locale prefixes when gt.config.json
   * enables localeRouting, e.g. when the app already declares `{-$locale}`
   * routes or its own locale rewrite.
   */
  localeRewrite?: false;
};
