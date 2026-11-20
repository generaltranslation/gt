import fs from 'node:fs';
import path from 'node:path';
import type { UnpluginBuildContext, UnpluginContextMeta } from 'unplugin';

type ViteOutputOptions = { sourcemap?: boolean | string };

/** What a resolved Vite config says of source maps. */
export type ViteSourceMapConfig = {
  command: string;
  build: {
    sourcemap: boolean | string;
    /** Vite 7 and earlier write a map for an output that asks for one here */
    rollupOptions?: { output?: ViteOutputOptions | ViteOutputOptions[] };
  };
};

function writesSourceMap({ command, build }: ViteSourceMapConfig): boolean {
  // A dev server always reads the map
  if (command !== 'build' || build.sourcemap) return true;
  const output = build.rollupOptions?.output ?? [];
  return (Array.isArray(output) ? output : [output]).some(
    ({ sourcemap }) => sourcemap
  );
}

type TransformContext = Pick<UnpluginBuildContext, 'getNativeBuildContext'> & {
  /** Vite 6 and later: the environment a module is transformed for */
  environment?: { config?: ViteSourceMapConfig };
};

export type SourceMapRequest = {
  /** The map of the code the transform received, to trace the transform's map through */
  inputSourceMap?: object | string;
};

const SOURCE_MAP_URL =
  /\/\/[#@]\s*sourceMappingURL=(\S+)|\/\*[#@]\s*sourceMappingURL=(\S+?)\s*\*\//g;
const DATA_URL = /^data:application\/json[^,]*?(;base64)?,([\s\S]*)$/;
const URL_SCHEME = /^[a-z][a-z\d+.-]+:/i;

/**
 * The source map a file names in its last `sourceMappingURL` comment, inline
 * or in a file next to it, with the sources that are paths as absolute
 * paths. Undefined when the file names none that can be read.
 */
function readSourceMapOf(code: string, id: string): object | undefined {
  if (!code.includes('sourceMappingURL=')) return undefined;
  const comments = [...code.matchAll(SOURCE_MAP_URL)];
  const last = comments[comments.length - 1];
  const url = last?.[1] ?? last?.[2];
  if (!url) return undefined;
  const file = id.replace(/[?#].*$/, '');
  const inline = DATA_URL.exec(url);
  if (!inline && URL_SCHEME.test(url)) return undefined;
  try {
    const mapFile = inline ? file : path.resolve(path.dirname(file), url);
    const map: unknown = JSON.parse(
      !inline
        ? fs.readFileSync(mapFile, 'utf8')
        : inline[1]
          ? Buffer.from(inline[2], 'base64').toString('utf8')
          : decodeURIComponent(inline[2])
    );
    if (
      typeof map !== 'object' ||
      map === null ||
      !('mappings' in map) ||
      typeof map.mappings !== 'string' ||
      !('sources' in map) ||
      !Array.isArray(map.sources)
    ) {
      return undefined;
    }
    const root =
      'sourceRoot' in map && typeof map.sourceRoot === 'string'
        ? map.sourceRoot
        : '';
    // Whoever reads the map joins a root that is a URL to its sources
    if (URL_SCHEME.test(root)) return map;
    return {
      ...map,
      sourceRoot: undefined,
      sources: map.sources.map((source: unknown) =>
        typeof source !== 'string' || URL_SCHEME.test(source)
          ? source
          : path
              .resolve(path.dirname(mapFile), root, source)
              .replace(/\\/g, '/')
      ),
    };
  } catch {
    return undefined;
  }
}

/**
 * How a transform writes its source map for the bundler that called it.
 * Undefined where the bundler reads none: a Vite or esbuild build without
 * source maps, and a webpack or Rspack loader that received no map.
 * @param code The code the transform received, from the file `id`.
 */
export function getSourceMapRequest(
  framework: UnpluginContextMeta['framework'],
  context: TransformContext,
  viteConfig: ViteSourceMapConfig | undefined,
  code: string,
  id: string
): SourceMapRequest | undefined {
  if (framework === 'vite') {
    const config = context.environment?.config ?? viteConfig;
    return config && !writesSourceMap(config) ? undefined : {};
  }
  const native = context.getNativeBuildContext?.();
  if (native?.framework === 'esbuild') {
    if (!native.build.initialOptions.sourcemap) return undefined;
    // esbuild reads the map a file names, and only the one unplugin appends for this transform once there is one
    return { inputSourceMap: readSourceMapOf(code, id) };
  }
  if (native?.framework === 'webpack' || native?.framework === 'rspack') {
    // unplugin passes a loader's map on in place of the one the loader received, without merging the two, and drops it when the loader received none
    const { inputSourceMap } = native;
    return inputSourceMap ? { inputSourceMap } : undefined;
  }
  return framework === 'webpack' || framework === 'rspack' ? undefined : {};
}
