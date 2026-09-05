import { createRequire } from 'module';
import { describe, expect, it, vi } from 'vitest';
import { AutoJsxWebpackPlugin } from '../webpackPlugin';

const require = createRequire(import.meta.url);
const wasm = '/project/gt-next/dist/gt_swc_plugin.wasm';
const nextLoader =
  require.resolve('next/dist/build/webpack/loaders/next-swc-loader');

type LoaderOptions = {
  bundleLayer?: string;
  jsConfig?: { compilerOptions?: { jsxImportSource?: string } };
  nextConfig: {
    compiler?: { emotion?: boolean };
    experimental: { swcPlugins: Array<[string, Record<string, unknown>]> };
  };
};
type Loader = { loader: string; options?: unknown };

function swcLoader(plugin = wasm, enabled = true, layer?: string): Loader {
  return {
    loader: nextLoader,
    options: {
      bundleLayer: layer,
      nextConfig: {
        compiler: { emotion: true },
        experimental: {
          swcPlugins: [
            [
              plugin,
              {
                jsxImportSourceFromLoader: enabled,
                enableAutoJsxInjection: true,
                compileTimeHash: true,
              },
            ],
          ],
        },
      },
    } satisfies LoaderOptions,
  };
}

function apply(loaders?: Loader[]) {
  let resolve: (module: { createData?: { loaders?: Loader[] } }) => void;
  const compiler = {
    hooks: {
      normalModuleFactory: {
        tap: vi.fn((_name, callback) => {
          callback({
            hooks: {
              afterResolve: {
                tap: vi.fn((_name, callback) => {
                  resolve = callback;
                }),
              },
            },
          });
        }),
      },
    },
  };
  new AutoJsxWebpackPlugin(wasm).apply(compiler);
  resolve!({ createData: { loaders } });
  return () => resolve!({ createData: { loaders } });
}

function pluginOptions(loader: Loader) {
  return (loader.options as LoaderOptions).nextConfig.experimental
    .swcPlugins[0][1];
}

describe('Webpack JSX runtime context', () => {
  it.each([
    ['rsc', 'react'],
    ['action-browser', 'react'],
    ['middleware', 'react'],
    ['instrument', 'react'],
    ['ssr', '@emotion/react'],
    ['app-pages-browser', '@emotion/react'],
    [undefined, '@emotion/react'],
  ])('uses canonical Next layer settings for %j', (layer, expected) => {
    const loader = swcLoader(wasm, true, layer);
    const originalOptions = loader.options;
    apply([loader]);
    expect(pluginOptions(loader)).toEqual({
      jsxImportSourceFromLoader: false,
      jsxImportSource: expected,
      enableAutoJsxInjection: true,
      compileTimeHash: true,
    });
    expect(loader.options).not.toBe(originalOptions);
    expect(
      (originalOptions as LoaderOptions).nextConfig.experimental
        .swcPlugins[0][1]
    ).not.toHaveProperty('jsxImportSource');
  });

  it.each(['react', 'custom-runtime', ''])(
    'preserves per-loader explicit source %j',
    (source) => {
      const loader = swcLoader(wasm, true, 'rsc');
      (loader.options as LoaderOptions).jsConfig = {
        compilerOptions: { jsxImportSource: source },
      };
      apply([loader]);
      expect(pluginOptions(loader).jsxImportSource).toBe(source);
    }
  );

  it('uses React when an individual loader disables Emotion', () => {
    const loader = swcLoader();
    (loader.options as LoaderOptions).nextConfig.compiler = { emotion: false };
    apply([loader]);
    expect(pluginOptions(loader).jsxImportSource).toBe('react');
  });

  it('preserves user loader order including JSX-generating loaders', () => {
    const post = { loader: '/user/post-loader.js' };
    const swc = swcLoader();
    const mdx = { loader: '/user/mdx-loader.js' };
    const loaders = [post, swc, mdx];
    apply(loaders);
    expect(loaders).toEqual([post, swc, mdx]);
    expect(pluginOptions(swc).jsxImportSourceFromLoader).toBe(false);
  });

  it('does not modify dependencies or SWC invocations without our bridge option', () => {
    const loaders = [
      { loader: '/next/dist/other-loader.js' },
      { loader: '/user/next-swc-loader.js.backup' },
      { loader: nextLoader },
      swcLoader('/third-party/plugin.wasm'),
      swcLoader(wasm, false),
    ];
    const original = loaders.map((loader) => ({ ...loader }));
    apply(loaders);
    expect(loaders).toEqual(original);
  });

  it('keeps repeated resolution stable', () => {
    const loader = swcLoader();
    const again = apply([loader]);
    const options = loader.options;
    again();
    expect(loader.options).toBe(options);
  });

  it('preserves unrelated plugin entries and flags', () => {
    const loader = swcLoader();
    const extra: [string, Record<string, unknown>] = [
      '/third-party/plugin.wasm',
      { custom: true },
    ];
    (loader.options as LoaderOptions).nextConfig.experimental.swcPlugins.push(
      extra
    );
    apply([loader]);
    expect(
      (loader.options as LoaderOptions).nextConfig.experimental.swcPlugins[1]
    ).toBe(extra);
  });

  it('preserves an independent same-WASM entry without the bridge flag', () => {
    const loader = swcLoader();
    const independent: [string, Record<string, unknown>] = [
      wasm,
      {
        jsxImportSource: 'independent-runtime',
        jsxImportSourceFromLoader: false,
        enableAutoJsxInjection: true,
      },
    ];
    (loader.options as LoaderOptions).nextConfig.experimental.swcPlugins.push(
      independent
    );
    apply([loader]);
    expect(
      (loader.options as LoaderOptions).nextConfig.experimental.swcPlugins[1]
    ).toBe(independent);
    expect(independent[1].jsxImportSource).toBe('independent-runtime');
  });

  it('reports an unknown Next loader installation instead of inferring a layer', () => {
    const loader = swcLoader();
    loader.loader =
      '/missing/next/dist/build/webpack/loaders/next-swc-loader.js';
    expect(() => apply([loader])).toThrow(
      /gt-next \(plugin\).*Next.js JSX runtime settings could not be read/
    );
  });

  it('supports loaderless modules', () => {
    expect(() => apply()).not.toThrow();
  });
});
