import path from 'path';
import {
  createGtNextPluginDiagnostic,
  formatDiagnosticErrorDetails,
} from '../../errors/diagnostics';

type Loader = { loader: string; options?: unknown };
type ResolvedModule = { createData?: { loaders?: Loader[] } };

type Compiler = {
  hooks: {
    normalModuleFactory: {
      tap: (
        name: string,
        callback: (factory: {
          hooks: {
            afterResolve: {
              tap: (
                name: string,
                callback: (module: ResolvedModule) => void
              ) => void;
            };
          };
        }) => void
      ) => void;
    };
  };
};

type SwcLoaderOptions = {
  bundleLayer?: string;
  jsConfig?: { compilerOptions?: { jsxImportSource?: string } };
  nextConfig?: {
    compiler?: { emotion?: unknown };
    experimental?: { swcPlugins?: unknown[] };
  };
};

function hasRuntimeBridge(loader: Loader, wasm: string): boolean {
  if (!/(?:^|[/\\])next-swc-loader(?:\.js)?$/.test(loader.loader)) return false;
  const options = loader.options as SwcLoaderOptions | undefined;
  return !!options?.nextConfig?.experimental?.swcPlugins?.some(
    (plugin) =>
      Array.isArray(plugin) &&
      plugin[0] === wasm &&
      plugin[1]?.jsxImportSourceFromLoader === true
  );
}

const serverLayers = new Map<string, Set<string>>();

function getServerLayers(loader: string): Set<string> {
  const constantsPath = path.resolve(
    path.dirname(loader),
    '../../../lib/constants.js'
  );
  const cached = serverLayers.get(constantsPath);
  if (cached) return cached;
  try {
    // Next exposes no public per-loader JSX options API. Read its canonical
    // layer group beside this exact loader, not another app's installed Next.
    const layers: unknown =
      require(constantsPath).WEBPACK_LAYERS?.GROUP?.serverOnly;
    if (
      !Array.isArray(layers) ||
      !layers.every((layer) => typeof layer === 'string')
    )
      throw new TypeError('WEBPACK_LAYERS.GROUP.serverOnly is unavailable');
    const result = new Set<string>(layers);
    serverLayers.set(constantsPath, result);
    return result;
  } catch (error) {
    throw new Error(
      createGtNextPluginDiagnostic({
        severity: 'Error',
        whatHappened: 'The Next.js JSX runtime settings could not be read',
        fix: 'Check that the SWC loader comes from the installed Next.js package',
        details: [loader, formatDiagnosticErrorDetails(error)].filter(
          (detail): detail is string => detail !== undefined
        ),
      })
    );
  }
}

/** Supply each actual Next SWC invocation with its own host JSX import source. */
export class AutoJsxWebpackPlugin {
  constructor(private readonly wasm: string) {}

  apply(compiler: Compiler) {
    compiler.hooks.normalModuleFactory.tap('GtAutoJsxRuntime', (factory) => {
      factory.hooks.afterResolve.tap('GtAutoJsxRuntime', (module) => {
        const loaders = module.createData?.loaders;
        if (!loaders) return;
        for (const loader of loaders) {
          if (!hasRuntimeBridge(loader, this.wasm)) continue;
          const options = loader.options as SwcLoaderOptions;
          const nextConfig = options.nextConfig!;
          const experimental = nextConfig.experimental!;
          const jsxImportSource =
            options.jsConfig?.compilerOptions?.jsxImportSource ??
            (nextConfig.compiler?.emotion &&
            !getServerLayers(loader.loader).has(options.bundleLayer ?? '')
              ? '@emotion/react'
              : 'react');
          // Clone only this invocation. Shared modules and defaultLoaders.babel
          // can use different host settings even within the same module graph.
          loader.options = {
            ...options,
            nextConfig: {
              ...nextConfig,
              experimental: {
                ...experimental,
                swcPlugins: experimental.swcPlugins!.map((plugin) =>
                  Array.isArray(plugin) &&
                  plugin[0] === this.wasm &&
                  plugin[1]?.jsxImportSourceFromLoader === true
                    ? [
                        plugin[0],
                        {
                          ...plugin[1],
                          jsxImportSource,
                          jsxImportSourceFromLoader: false,
                        },
                      ]
                    : plugin
                ),
              },
            },
          };
        }
      });
    });
  }
}
