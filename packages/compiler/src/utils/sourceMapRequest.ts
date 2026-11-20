import type { UnpluginBuildContext, UnpluginContextMeta } from 'unplugin';

/** What a resolved Vite config says of source maps. */
export type ViteSourceMapConfig = {
  command: string;
  build: { sourcemap: boolean | string };
};

type TransformContext = Pick<UnpluginBuildContext, 'getNativeBuildContext'> & {
  /** Vite 6 and later: the environment a module is transformed for */
  environment?: { config?: ViteSourceMapConfig };
};

export type SourceMapRequest = {
  /** The map of the code the transform received, to trace the transform's map through */
  inputSourceMap?: object | string;
};

/**
 * How a transform writes its source map for the bundler that called it.
 * Undefined where the bundler reads none: a Vite or esbuild build without
 * source maps, and a webpack or Rspack loader that received no map.
 */
export function getSourceMapRequest(
  framework: UnpluginContextMeta['framework'],
  context: TransformContext,
  viteConfig: ViteSourceMapConfig | undefined
): SourceMapRequest | undefined {
  if (framework === 'vite') {
    const config = context.environment?.config ?? viteConfig;
    // A dev server always reads the map
    return config?.command === 'build' && !config.build.sourcemap
      ? undefined
      : {};
  }
  const native = context.getNativeBuildContext?.();
  if (native?.framework === 'esbuild') {
    return native.build.initialOptions.sourcemap ? {} : undefined;
  }
  if (native?.framework === 'webpack' || native?.framework === 'rspack') {
    // unplugin passes a loader's map on in place of the one the loader received, without merging the two, and drops it when the loader received none
    const { inputSourceMap } = native;
    return inputSourceMap ? { inputSourceMap } : undefined;
  }
  return framework === 'webpack' || framework === 'rspack' ? undefined : {};
}
