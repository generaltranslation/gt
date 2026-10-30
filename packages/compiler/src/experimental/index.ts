/**
 * `@generaltranslation/compiler/experimental`: the GT compiler plugin with
 * the experimental locale twins translation splitting strategy
 * (`experimental.splitting: "locale-twins"` in gt.config.json, or the
 * `splitting` option). Locale twins need Vite; with the strategy off this
 * plugin behaves like the regular one.
 */
import { createUnplugin } from 'unplugin';
import { createGTUnpluginFactory } from './createGTUnpluginFactory';
import { resolveLocaleTwinsSettings } from './config';
import type { GTUnpluginOptions } from './config';
import { createLocaleTwinsPlugin } from './locale-twins/createLocaleTwinsPlugin';
import { EXPERIMENTAL_IMPORT_SOURCES } from './utils/importSources';

export type {
  GTUnpluginOptions,
  LocaleTwinsOptions,
  ResolvedLocaleTwinsOptions,
} from './config';
export type { LocaleTwinManifest } from 'generaltranslation/internal/experimental';

const createFactory = createGTUnpluginFactory<GTUnpluginOptions>(
  ({ options, meta, finishBuild }) => {
    // Resolved once, so an invalid strategy fails at plugin creation
    const { splitting, localeTwins } = resolveLocaleTwinsSettings(options);
    return createLocaleTwinsPlugin({
      splitting,
      localeTwins,
      gtConfig: options.gtConfig,
      compileTimeHash: options.compileTimeHash !== false,
      // gt.config.json and files.gt.output are relative to the working directory
      configDir: process.cwd(),
      logLevel: options.logLevel,
      framework: meta.framework,
      onBuildEnd: finishBuild,
    });
  }
);

/**
 * The experimental GT compiler plugin for every bundler unplugin supports
 * (locale twins need Vite; other bundlers get a warning and no twins).
 */
export const unplugin = createUnplugin<GTUnpluginOptions | undefined>(
  (options = {}, meta) =>
    createFactory(
      {
        ...options,
        // Auto-inserted <T> must be the locale twin version
        autoJsxImportSource:
          options.autoJsxImportSource ?? EXPERIMENTAL_IMPORT_SOURCES.GT_REACT,
      },
      meta
    )
);

/** The experimental GT compiler plugin for Vite. */
export const vite = unplugin.vite;
