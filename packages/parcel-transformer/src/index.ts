import { createRequire } from 'node:module';
import { Transformer } from '@parcel/plugin';
import type { GTUnpluginOptions } from '@generaltranslation/compiler';

/**
 * A parsed `gt.config.json`, passed straight through to the GT compiler as its
 * `gtConfig` option. Kept intentionally loose: the compiler owns the schema.
 */
export type GtParcelConfig = GTUnpluginOptions;

/**
 * The subset of the GT compiler's return value we consume. The compiler runs a
 * Babel pipeline and returns Babel's generator result (`{ code, map }`) or
 * `null` when a file needs no changes.
 */
type GtTransformResult = { code: string; map?: unknown } | null | undefined;

type GtTransformFn = (
  code: string,
  id: string
) => GtTransformResult | Promise<GtTransformResult>;

/**
 * The raw unplugin object the GT compiler produces. unplugin allows a `transform`
 * hook to be either a plain function or a `{ filter, handler }` object, so we
 * accept both shapes for forward compatibility even though the GT compiler
 * currently ships a plain function.
 */
type RawGtPlugin = {
  transformInclude?: (id: string) => boolean;
  transform?: GtTransformFn | { handler: GtTransformFn };
};

type RawFactory = (
  options: GTUnpluginOptions,
  meta: { framework: string }
) => RawGtPlugin;

// The GT compiler and Babel are published as CommonJS. Load them through
// createRequire so we always get Node's real CommonJS interop: Parcel loads
// this plugin as ESM, and different ESM<->CJS interop layers (Parcel, Vitest,
// plain Node) otherwise disagree on where the exports end up.
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

// Babel is used to lower TSX/JSX to the automatic JSX runtime while preserving
// ES module imports. This is exactly the shape the GT compiler expects: it
// injects `_hash` values into `jsx(T, ...)` / `jsxs(T, ...)` call expressions
// and `t()` calls, and it tracks the `react/jsx-runtime` and `gt-react` imports
// to find them. See the "Why Babel runs first" note in the README.
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
 * Lower a TS/TSX/JS/JSX source file to plain ES modules using the automatic JSX
 * runtime, without bundling. TypeScript types are stripped and `<T>` style JSX
 * becomes `jsx(T, ...)` / `jsxs(T, ...)` calls importing from
 * `react/jsx-runtime`.
 *
 * The automatic runtime's non-development form is used unconditionally (even in
 * Parcel dev mode). The GT compiler recognizes `jsx` / `jsxs` but not the
 * development helper `jsxDEV`, so emitting `jsxDEV` would silently skip hash
 * injection. The only cost is the loss of React's `__source` / `__self` debug
 * props, which Parcel does not rely on.
 *
 * @internal Exposed for tests and advanced integrations.
 */
export function compileJsxToEsm(code: string, id: string): string {
  const { babel, presetReact, presetTypescript, decoratorsPlugin } =
    loadBabel();
  const result = babel.transformSync(code, {
    filename: id,
    configFile: false,
    babelrc: false,
    sourceMaps: false,
    // Parse and lower legacy decorators. The GT compiler parses source with the
    // decorators-legacy plugin, so a decorated file it would otherwise inject
    // into must survive this lowering step too; without the plugin Babel throws
    // on the decorator and the transformer skips the file, silently dropping GT
    // injection. Plugins run before presets, so decorators are handled before
    // preset-typescript strips the surrounding types.
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
 * Build the GT compiler's raw plugin for the given options. Each call re-runs
 * the compiler's config resolution, so callers that transform many files should
 * reuse a single instance (see the module-level cache in the Transformer).
 *
 * unplugin's `.raw()` requires a framework in its meta. The GT compiler
 * transform is bundler-agnostic (it never reads the framework), so any valid
 * value works; 'rollup' is the closest generic to Parcel's compile-then-bundle
 * flow.
 *
 * @internal Exposed for tests and advanced integrations.
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

/**
 * Run the GT compiler transform on already-lowered code (jsx() calls, ES module
 * imports). Returns the transformed code, or `null` when the file was left
 * unchanged. This is the same compiler core the webpack/Vite/Rollup adapters
 * use; it does not lower JSX itself, which is why {@link compileJsxToEsm} runs
 * first.
 *
 * @internal Exposed for tests and advanced integrations.
 */
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

/**
 * Full transformer pipeline for one source file: lower JSX/TS with Babel, then
 * run the GT compiler over the result. Returns the compiled + hash-injected
 * code, or `null` when the file has no GT usage (in which case the caller
 * should leave the original source for Parcel's default pipeline to handle).
 *
 * @internal Exposed for tests and advanced integrations.
 */
export async function transformSource(
  code: string,
  id: string,
  options: GTUnpluginOptions = {}
): Promise<string | null> {
  const lowered = compileJsxToEsm(code, id);
  return runGtCompilerTransform(lowered, id, options);
}

/**
 * Cheap pre-gate run before the Babel lowering. A source file can only use GT
 * if it imports from `gt-react` / `gt-next` (the only way `t()` and the `<T>`
 * family arrive) or contains a `<T` JSX tag. Everything else cannot produce a
 * hash, so lowering it with Babel would be wasted work. This mirrors the GT
 * compiler's own no-op bail (it returns null for files with no GT content) and
 * keeps the transformer from re-lowering every non-GT file in the app graph.
 *
 * The check is deliberately a substring scan, not a parse: it is allowed to
 * yield false positives (a `<Table>` tag or the text "gt-react" in a comment
 * just means the file is lowered and the compiler then finds nothing), but it
 * never yields false negatives for real GT usage, because real usage always
 * carries one of these substrings.
 *
 * @internal Exposed for tests and advanced integrations.
 */
export function hasGtSignal(code: string): boolean {
  return (
    code.includes('gt-react') || code.includes('gt-next') || code.includes('<T')
  );
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
 * Parcel transformer for the General Translation compiler.
 *
 * It runs ahead of Parcel's default JS/TS handling. Because the GT compiler
 * operates on compiled `jsx()` call expressions rather than raw JSX elements,
 * the transformer first lowers each source file to the automatic JSX runtime
 * (via Babel), then runs the compiler to inject compile-time `_hash` values
 * into `<T>` components and `t()` calls, exactly like the Vite/webpack adapters.
 * Parcel's default transformer then bundles the result.
 *
 * Parcel resolves plugins by package name and requires a default export, so this
 * module intentionally uses `export default` despite the repo convention.
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
