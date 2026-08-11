import { createRequire } from 'node:module';
import { Transformer } from '@parcel/plugin';
import type { GTUnpluginOptions } from '@generaltranslation/compiler';

/** A parsed `gt.config.json`, passed through as the compiler's `gtConfig`; it owns the schema. */
export type GtParcelConfig = GTUnpluginOptions;

/** The compiler result we consume: Babel's `{ code, map }`, or `null` when unchanged. */
type GtTransformResult = { code: string; map?: unknown } | null | undefined;

type GtTransformFn = (
  code: string,
  id: string
) => GtTransformResult | Promise<GtTransformResult>;

/** The raw unplugin object the GT compiler produces; both `transform` hook shapes work. */
type RawGtPlugin = {
  transformInclude?: (id: string) => boolean;
  transform?: GtTransformFn | { handler: GtTransformFn };
};

type RawFactory = (
  options: GTUnpluginOptions,
  meta: { framework: string }
) => RawGtPlugin;

// The GT compiler and Babel are published as CommonJS. Load them through createRequire
// for Node's real CJS interop: Parcel, Vitest, and plain Node otherwise disagree on
// where the exports land.
const requireFromHere = createRequire(import.meta.url);

function loadRawFactory(): RawFactory {
  const mod = requireFromHere('@generaltranslation/compiler') as {
    default?: { raw?: RawFactory };
    raw?: RawFactory;
  };
  const instance = mod.default ?? mod;
  const raw = instance?.raw ?? mod.raw;
  if (typeof raw !== 'function') {
    throw new Error(
      '@generaltranslation/parcel-transformer: could not resolve the GT compiler ' +
        'raw() factory from @generaltranslation/compiler. Is the package installed?'
    );
  }
  return raw;
}

let rawFactory: RawFactory | undefined;

function getRawFactory(): RawFactory {
  return (rawFactory ??= loadRawFactory());
}

// Babel lowers TSX/JSX to the automatic JSX runtime while preserving ES module imports.
// The GT compiler needs that shape: it injects `_hash` into `jsx(T, ...)` and `t()` calls,
// tracking the `react/jsx-runtime` and `gt-react` imports. See "Why Babel runs first".
type BabelModule = {
  transformSync: (
    code: string,
    opts: Record<string, unknown>
  ) => { code?: string | null } | null;
};

let babel: BabelModule | undefined;
let presetReact: unknown;
let presetTypescript: unknown;
let decoratorsPlugin: unknown;

function loadBabel(): {
  babel: BabelModule;
  presetReact: unknown;
  presetTypescript: unknown;
  decoratorsPlugin: unknown;
} {
  babel ??= requireFromHere('@babel/core') as BabelModule;
  const react = requireFromHere('@babel/preset-react') as {
    default?: unknown;
  };
  const ts = requireFromHere('@babel/preset-typescript') as {
    default?: unknown;
  };
  const decorators = requireFromHere('@babel/plugin-proposal-decorators') as {
    default?: unknown;
  };
  presetReact ??= react.default ?? react;
  presetTypescript ??= ts.default ?? ts;
  decoratorsPlugin ??= decorators.default ?? decorators;
  return { babel, presetReact, presetTypescript, decoratorsPlugin };
}

/**
 * Lowers TS/TSX with the automatic JSX runtime, never `jsxDEV` (the compiler skips it). @internal
 */
export function compileJsxToEsm(code: string, id: string): string {
  const { babel, presetReact, presetTypescript, decoratorsPlugin } =
    loadBabel();
  const result = babel.transformSync(code, {
    filename: id,
    configFile: false,
    babelrc: false,
    sourceMaps: false,
    // Parse legacy decorators: the GT compiler uses decorators-legacy, so a decorated
    // file must survive this lowering too, or Babel throws and the file is skipped.
    // Plugins run before presets, so decorators are handled before types are stripped.
    plugins: [[decoratorsPlugin, { legacy: true }]],
    // preset order is reverse: preset-react runs first (JSX -> jsx() calls),
    // then preset-typescript strips the remaining type syntax.
    presets: [
      presetTypescript,
      [presetReact, { runtime: 'automatic', development: false }],
    ],
  });
  const out = result?.code;
  if (typeof out !== 'string') {
    throw new Error(
      `@generaltranslation/parcel-transformer: Babel produced no output for ${id}.`
    );
  }
  return out;
}

/**
 * Builds the raw GT plugin; reuse it (config re-resolves), `rollup` meta is arbitrary. @internal
 */
export function createGtRawPlugin(
  options: GTUnpluginOptions = {},
  framework = 'rollup'
): RawGtPlugin {
  return getRawFactory()(options, { framework });
}

function getTransformInclude(
  plugin: RawGtPlugin
): ((id: string) => boolean) | undefined {
  return typeof plugin.transformInclude === 'function'
    ? plugin.transformInclude
    : undefined;
}

function getTransformFn(plugin: RawGtPlugin): GtTransformFn | undefined {
  const transform = plugin.transform;
  if (typeof transform === 'function') return transform;
  if (transform && typeof transform.handler === 'function') {
    return transform.handler;
  }
  return undefined;
}

/** Runs the GT compiler on already-lowered code; `null` when unchanged. @internal */
export async function runGtCompilerTransform(
  code: string,
  id: string,
  options: GTUnpluginOptions = {},
  framework = 'rollup'
): Promise<string | null> {
  const plugin = createGtRawPlugin(options, framework);
  const transformInclude = getTransformInclude(plugin);
  if (transformInclude && !transformInclude(id)) return null;

  const transform = getTransformFn(plugin);
  if (!transform) return null;

  const result = await transform(code, id);
  if (result && typeof result === 'object' && typeof result.code === 'string') {
    return result.code;
  }
  return null;
}

/** Lowers one file, then runs the GT compiler; `null` when it has no GT usage. @internal */
export async function transformSource(
  code: string,
  id: string,
  options: GTUnpluginOptions = {}
): Promise<string | null> {
  const lowered = compileJsxToEsm(code, id);
  return runGtCompilerTransform(lowered, id, options);
}

/**
 * Cheap regex pre-gate: a gt-react/gt-next import or a `<T` tag boundary, not `<Table>`. @internal
 */
const GT_SIGNAL_RE = /gt-react|gt-next|<T[\s>\/]/;

export function hasGtSignal(code: string): boolean {
  return GT_SIGNAL_RE.test(code);
}

// Cache the resolved raw plugin per options signature. Parcel calls transform()
// once per source asset; re-resolving the GT config for every file would repeat
// disk reads and warnings.
let cached: { key: string; plugin: RawGtPlugin } | undefined;

function resolveCachedPlugin(options: GTUnpluginOptions): RawGtPlugin {
  const key = JSON.stringify(options ?? {});
  if (cached && cached.key === key) return cached.plugin;
  const plugin = createGtRawPlugin(options);
  cached = { key, plugin };
  return plugin;
}

/**
 * Parcel transformer for the GT compiler. Parcel needs a default export, unlike the repo norm.
 */
export default new Transformer<GtParcelConfig | null>({
  async loadConfig({ config }) {
    // getConfig registers gt.config.json as a config dependency, so Parcel
    // invalidates transformed assets when it changes.
    const found = await config.getConfig<GtParcelConfig>(['gt.config.json']);
    return found?.contents ?? null;
  },

  async transform({ asset, config, logger }) {
    // Only transform first-party source. GT usage lives in app code; skipping
    // node_modules avoids re-compiling already-built dependencies with Babel.
    if (!asset.isSource) return [asset];

    const gtConfig = config as GtParcelConfig | null;
    const options: GTUnpluginOptions = gtConfig ? { gtConfig } : {};
    const plugin = resolveCachedPlugin(options);

    const id = asset.filePath;
    const transformInclude = getTransformInclude(plugin);
    if (transformInclude && !transformInclude(id)) return [asset];

    const transform = getTransformFn(plugin);
    if (!transform) {
      logger.warn({
        message:
          'GT compiler exposed no transform hook; leaving asset unchanged.',
      });
      return [asset];
    }

    const code = await asset.getCode();

    // Pre-gate: skip the Babel lowering for files that cannot use GT. This is
    // the common case in a real app graph, and it mirrors the GT compiler's own
    // bail for content-free files.
    if (!hasGtSignal(code)) return [asset];

    let lowered: string;
    try {
      lowered = compileJsxToEsm(code, id);
    } catch (error) {
      // If Babel cannot parse the file, leave it untouched and let Parcel's
      // default pipeline report the real syntax error with better diagnostics.
      logger.warn({
        message: `GT transformer skipped ${id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
      return [asset];
    }

    const result = await transform(lowered, id);
    if (
      result &&
      typeof result === 'object' &&
      typeof result.code === 'string'
    ) {
      // The file uses GT: hand Parcel the lowered + hash-injected code. The GT
      // transform does not emit a source map from this pass (the Vite/webpack
      // adapters behave the same way), so none is forwarded.
      asset.setCode(result.code);
    }
    // When the GT compiler returns null the file has no GT usage. Leave the
    // original source in place so Parcel's default transformer compiles it,
    // rather than shipping our intermediate Babel output.

    return [asset];
  },
});
