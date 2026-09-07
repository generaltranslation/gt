import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UnpluginBuildContext, UnpluginContext } from 'unplugin';
import { hashSource } from 'generaltranslation/id';
import gtUnplugin, { type GTUnpluginOptions } from '../index';

type Driver = 'raw' | 'vite' | 'rollup';

const disabledOptions: { name: string; options: GTUnpluginOptions }[] = [
  { name: 'absent', options: {} },
  { name: 'explicitly false', options: { enableAutoJsxInjection: false } },
  {
    name: 'false in gt.config',
    options: {
      gtConfig: {
        files: { gt: { parsingFlags: { enableAutoJsxInjection: false } } },
      },
    },
  },
  {
    name: 'false overriding gt.config',
    options: {
      enableAutoJsxInjection: false,
      gtConfig: {
        files: { gt: { parsingFlags: { enableAutoJsxInjection: true } } },
      },
    },
  },
  {
    name: 'own undefined overriding gt.config',
    options: {
      enableAutoJsxInjection: undefined,
      gtConfig: {
        files: { gt: { parsingFlags: { enableAutoJsxInjection: true } } },
      },
    },
  },
  {
    name: 'own null overriding gt.config',
    options: {
      // JavaScript consumers can explicitly override the configuration with null.
      enableAutoJsxInjection: null as unknown as boolean,
      gtConfig: {
        files: { gt: { parsingFlags: { enableAutoJsxInjection: true } } },
      },
    },
  },
];

const context = {
  addWatchFile() {},
  emitFile() {},
  getWatchFiles: () => [],
  parse() {
    throw new Error('Unexpected host parser use');
  },
  warn() {},
  error(message: unknown) {
    throw new Error(String(message));
  },
} as UnpluginBuildContext & UnpluginContext;

function createPlugin(driver: Driver, options: GTUnpluginOptions) {
  const resolved = { gtConfig: {}, logLevel: 'silent' as const, ...options };
  return driver === 'raw'
    ? gtUnplugin.raw(resolved, { framework: 'webpack' })
    : gtUnplugin[driver](resolved);
}

async function transformPlugin(
  plugin: ReturnType<typeof createPlugin>,
  input: string,
  filename = '/workspace/src/Page.tsx'
) {
  const hook =
    typeof plugin.transform === 'function'
      ? plugin.transform
      : plugin.transform?.handler;
  if (!hook) throw new Error('Missing public compiler transform');
  const result = await hook.call(context, input, filename);
  return typeof result === 'string' ? result : (result?.code ?? null);
}

async function transform(
  driver: Driver,
  input: string,
  options: GTUnpluginOptions,
  filename = '/workspace/src/Page.tsx'
) {
  return transformPlugin(createPlugin(driver, options), input, filename);
}

const manual = `import {jsx} from 'react/jsx-runtime'; import {T} from 'gt-react';
export const Page=()=>jsx(T,{children:'Manual text'});`;
const strings = `import {useGT} from 'gt-react'; const gt=useGT();
export const text=gt('String text');`;
const macro = `import {useGT} from 'gt-react'; const gt=useGT();
export const text=t\`Macro text\`;`;

afterEach(() => vi.restoreAllMocks());

describe.each(disabledOptions)('automatic JSX flag $name', ({ options }) => {
  describe.each<Driver>(['raw', 'vite', 'rollup'])(
    '%s integration',
    (driver) => {
      it('retains literal script suffix filtering including trailing line breaks', async () => {
        const plugin = createPlugin(driver, options);
        for (const extension of ['.js', '.jsx', '.ts', '.tsx']) {
          const filename = '/workspace/src/Page' + extension;
          if (driver === 'raw') {
            const include = plugin.transformInclude;
            if (!include) throw new Error('Missing raw resource filter');
            expect(await include(filename)).toBe(true);
            for (const suffix of ['\n', '\r', '\r\n', '\u2028', '\u2029'])
              expect(await include(filename + suffix)).toBe(false);
          } else {
            expect(await transformPlugin(plugin, manual, filename)).toContain(
              hashSource({ source: 'Manual text', dataFormat: 'JSX' })
            );
            for (const suffix of ['\n', '\r', '\r\n', '\u2028', '\u2029'])
              expect(
                await transformPlugin(plugin, manual, filename + suffix)
              ).toBeNull();
          }
        }
      });

      it.each(['autoderive', 'devHotReload'] as const)(
        'does not resolve nested %s getters during creation or resource filtering',
        async (setting) => {
          const read = vi.fn(() => {
            throw new Error(
              'Legacy option is resolved only for a transformed file'
            );
          });
          const plugin = createPlugin(driver, {
            ...options,
            [setting]: {
              get jsx(): boolean {
                return read();
              },
              get strings(): boolean {
                return read();
              },
            },
          });
          expect(read).not.toHaveBeenCalled();
          if (driver === 'raw') {
            const include = plugin.transformInclude;
            if (!include) throw new Error('Missing raw resource filter');
            expect(await include('/workspace/src/Page.raw')).toBe(false);
          } else {
            expect(
              await transformPlugin(plugin, manual, '/workspace/src/Page.raw')
            ).toBeNull();
          }
          expect(read).not.toHaveBeenCalled();
          await expect(transformPlugin(plugin, manual)).rejects.toThrow(
            'Legacy option is resolved only for a transformed file'
          );
          expect(read).toHaveBeenCalledTimes(1);
        }
      );

      it('retains manual JSX hashing without inserting automatic components', async () => {
        const output = await transform(driver, manual, {
          ...options,
          autoJsxRuntimePackageRoots: ['/workspace'],
        });
        expect(output).toContain(
          hashSource({ source: 'Manual text', dataFormat: 'JSX' })
        );
        expect(output).not.toContain('GtInternalTranslateJsx');
        expect(output).not.toContain('GtInternalVar');
        expect(
          await transform(driver, manual, {
            ...options,
            compileTimeHash: false,
          })
        ).toBeNull();
      });

      it('retains string hashes and useGT prefetch arguments', async () => {
        const output = await transform(driver, strings, options);
        expect(output).toContain('useGT([');
        expect(output).toContain(
          hashSource({ source: 'String text', dataFormat: 'ICU' })
        );
        expect(output).not.toContain('GtInternalTranslateJsx');
      });

      it('retains macro expansion independently of compile-time hashing', async () => {
        const output = await transform(driver, macro, {
          ...options,
          compileTimeHash: false,
        });
        expect(output).not.toBeNull();
        expect(output).not.toContain('t`');
        expect(output).not.toContain('$_hash');
        expect(output).toContain('Macro text');
        expect(
          await transform(driver, macro, {
            ...options,
            compileTimeHash: false,
            enableMacroTransform: false,
          })
        ).toBeNull();
      });

      it('retains the existing disabled-checks and disabled-hashing early exit', async () => {
        expect(
          await transform(driver, macro, {
            ...options,
            compileTimeHash: false,
            disableBuildChecks: true,
            enableMacroTransform: true,
            devHotReload: true,
          })
        ).toBeNull();
      });

      it('retains runtime translation when checks are active and hashing is disabled', async () => {
        const output = await transform(driver, strings, {
          ...options,
          compileTimeHash: false,
          devHotReload: { strings: true },
        });
        expect(output).toContain('GtInternalRuntimeTranslateString');
        expect(output).not.toContain('GtInternalTranslateJsx');
      });

      it.each(['T', 'GtInternalTranslateJsx'])(
        'retains dynamic-child validation for %s',
        async (component) => {
          const input = `import {jsx} from 'react/jsx-runtime';
import {${component}} from 'gt-next';
export const Page=()=>jsx(${component},{children:['Sparse ',,name]});`;
          await expect(
            transform(driver, input, { ...options, compileTimeHash: false })
          ).rejects.toThrow('invalid library usage');
        }
      );

      it('leaves ordinary React helpers and protected host elements untouched', async () => {
        const input = `import {jsx,jsxs} from 'react/jsx-runtime';
export const helper=jsxs; export const children=Object.freeze(['Static ',value]);
export const Page=()=>jsxs('main',{children:[jsx('p',{children}),jsx('style',{children:'p{color:red}'})]});`;
        expect(await transform(driver, input, options)).toBeNull();
      });

      it('retains parse diagnostics for malformed loader output', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(
          await transform(driver, null as unknown as string, {
            ...options,
            logLevel: 'error',
          })
        ).toBeNull();
        expect(error).toHaveBeenCalledExactlyOnceWith(
          expect.stringContaining('Error processing /workspace/src/Page.tsx:')
        );
      });
    }
  );

  it.each(['.mjs', '.cjs', '.raw', '.tsx?loader', '.jsx#generated'])(
    'preserves the raw transform contract for an adapter-provided %s resource',
    async (extension) => {
      const filename = '/workspace/src/Page' + extension;
      const output = await transform('raw', manual, options, filename);
      expect(output).toContain(
        hashSource({ source: 'Manual text', dataFormat: 'JSX' })
      );
      expect(output).not.toContain('GtInternalTranslateJsx');

      // Public Vite/Rollup integrations retain their own original extension
      // filter. The raw hook is also consumed by adapters that select resources.
      for (const driver of ['vite', 'rollup'] as const)
        expect(await transform(driver, manual, options, filename)).toBeNull();
    }
  );

  it('retains the raw resource filter error for non-string disabled IDs', () => {
    const plugin = gtUnplugin.raw(
      { gtConfig: {}, logLevel: 'silent', ...options },
      { framework: 'webpack' }
    );
    if (!plugin.transformInclude)
      throw new Error('Missing raw resource filter');
    for (const filename of [undefined, null, 42])
      expect(() =>
        plugin.transformInclude!(filename as unknown as string)
      ).toThrow(TypeError);
  });

  it('preserves raw-hook macro expansion and validation for generated IDs', async () => {
    expect(
      await transform(
        'raw',
        macro,
        { ...options, compileTimeHash: false },
        '/workspace/src/Page.mjs'
      )
    ).toContain('Macro text');
    await expect(
      transform(
        'raw',
        manual.replace("'Manual text'", 'name'),
        { ...options, compileTimeHash: false },
        '/workspace/src/Page.tsx?loader'
      )
    ).rejects.toThrow('invalid library usage');
  });
});

describe.each<Driver>(['raw', 'vite', 'rollup'])(
  '%s factory option precedence and per-file state',
  (driver) => {
    it.each([false, true])(
      'filters non-script resources when gt.config changes from %s in both directions',
      async (initial) => {
        const flags = { enableAutoJsxInjection: initial };
        const plugin = createPlugin(driver, {
          gtConfig: { files: { gt: { parsingFlags: flags } } },
        });
        const source = `${manual}\nexport const Automatic=()=>jsx('p',{children:'Automatic text'});`;
        for (const enabled of [initial, !initial, initial]) {
          flags.enableAutoJsxInjection = enabled;
          for (const extension of ['.raw', '.mdx']) {
            const filename = '/workspace/src/Page' + extension;
            if (driver === 'raw') {
              const include = plugin.transformInclude;
              if (!include) throw new Error('Missing raw resource filter');
              expect(await include(filename)).toBe(enabled);
              expect(await include('/workspace/src/Page.tsx')).toBe(true);
            } else {
              const output = await transformPlugin(plugin, source, filename);
              if (enabled) expect(output).toContain('GtInternalTranslateJsx');
              else expect(output).toBeNull();
            }
          }
        }
      }
    );

    it('reads the configuration auto flag only when filtering needs it', async () => {
      const read = vi.fn(() => false);
      const plugin = createPlugin(driver, {
        gtConfig: {
          files: {
            gt: {
              parsingFlags: {
                get enableAutoJsxInjection() {
                  return read();
                },
              },
            },
          },
        },
      });
      expect(read).not.toHaveBeenCalled();
      if (driver === 'raw') {
        const include = plugin.transformInclude;
        if (!include) throw new Error('Missing raw resource filter');
        expect(await include('/workspace/src/Page.tsx')).toBe(true);
        expect(read).not.toHaveBeenCalled();
        expect(await include('/workspace/src/Page.raw')).toBe(false);
      } else {
        expect(
          await transformPlugin(plugin, manual, '/workspace/src/Page.raw')
        ).toBeNull();
      }
      expect(read).toHaveBeenCalledTimes(1);
    });

    for (const configFlag of [undefined, false, true]) {
      for (const direct of ['absent', undefined, null, false, true] as const) {
        it(`keeps direct ${String(direct)} over gt.config ${String(configFlag)}`, async () => {
          const options: GTUnpluginOptions = {
            gtConfig: {
              files: {
                gt: { parsingFlags: { enableAutoJsxInjection: configFlag } },
              },
            },
            compileTimeHash: false,
            disableBuildChecks: true,
            ...(direct !== 'absent' && {
              enableAutoJsxInjection: direct as boolean | undefined,
            }),
          };
          const expected =
            direct === 'absent' ? Boolean(configFlag) : Boolean(direct);
          const source = `import {jsx} from 'react/jsx-runtime'; export const Page=()=>jsx('p',{children:'Automatic text'});`;
          const output = await transform(
            driver,
            source,
            options,
            '/workspace/src/Page.raw'
          );
          if (expected) expect(output).toContain('GtInternalTranslateJsx');
          else expect(output).toBeNull();
        });
      }
    }

    it.each(['autoderive', 'devHotReload'] as const)(
      'resolves nested gt.config %s only once for each transformed file',
      async (setting) => {
        const read = vi.fn(() => false);
        const plugin = createPlugin(driver, {
          gtConfig: {
            files: {
              gt: {
                parsingFlags: {
                  enableAutoJsxInjection: false,
                  [setting]: {
                    get jsx() {
                      return read();
                    },
                    get strings() {
                      return read();
                    },
                  },
                },
              },
            },
          },
        });
        expect(read).not.toHaveBeenCalled();
        for (const count of [2, 4]) {
          expect(await transformPlugin(plugin, manual)).toContain(
            hashSource({ source: 'Manual text', dataFormat: 'JSX' })
          );
          expect(read).toHaveBeenCalledTimes(count);
        }
      }
    );
  }
);

describe.each(['.mjs', '.cjs', '.raw', '.tsx?loader', '.jsx#generated'])(
  'per-file auto JSX exclusion on %s resources',
  (extension) => {
    const filename = '/workspace/runtime/entry' + extension;

    it('retains the complete raw transform when a runtime package only disables insertion', async () => {
      const options = {
        enableAutoJsxInjection: true,
        autoJsxRuntimePackageRoots: ['/workspace/runtime'],
      };
      for (const source of [manual, strings, macro]) {
        const expected = await transform(
          'raw',
          source,
          {
            enableAutoJsxInjection: false,
          },
          filename
        );
        expect(expected).not.toBeNull();
        expect(await transform('raw', source, options, filename)).toBe(
          expected
        );
      }
      await expect(
        transform(
          'raw',
          manual.replace("'Manual text'", 'name'),
          options,
          filename
        )
      ).rejects.toThrow('invalid library usage');
    });

    it('uses the current per-file flag after gt.config disables insertion', async () => {
      const flags = { enableAutoJsxInjection: true };
      const plugin = createPlugin('raw', {
        gtConfig: { files: { gt: { parsingFlags: flags } } },
      });
      flags.enableAutoJsxInjection = false;
      expect(await transformPlugin(plugin, manual, filename)).toBe(
        await transform(
          'raw',
          manual,
          { enableAutoJsxInjection: false },
          filename
        )
      );
    });

    it.each([null, undefined])(
      'retains existing parse diagnostics for excluded source %s',
      async (source) => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(
          await transform(
            'raw',
            source as unknown as string,
            {
              enableAutoJsxInjection: true,
              autoJsxRuntimePackageRoots: ['/workspace/runtime'],
              logLevel: 'error',
            },
            filename
          )
        ).toBeNull();
        expect(error).toHaveBeenCalledExactlyOnceWith(
          expect.stringContaining(`Error processing ${filename}:`)
        );
      }
    );
  }
);

it('keeps automatic post-loader insertion and virtual-resource handling opt-in', async () => {
  const options = {
    gtConfig: {},
    enableAutoJsxInjection: true,
    compileTimeHash: false,
    disableBuildChecks: true,
  };
  const source = `import {jsx} from 'react/jsx-runtime'; export const Page=()=>jsx('p',{children:'Automatic text'});`;
  for (const driver of ['raw', 'vite', 'rollup'] as const) {
    expect(
      await transform(driver, source, options, '/workspace/src/Page.raw')
    ).toContain('GtInternalTranslateJsx');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(
      await transform(driver, null as unknown as string, {
        ...options,
        logLevel: 'error',
      })
    ).toBeNull();
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  }
});

it.each([undefined, null])(
  'keeps enabled virtual resources with a %s ID eligible',
  async (filename) => {
    const plugin = gtUnplugin.raw(
      { gtConfig: {}, logLevel: 'error', enableAutoJsxInjection: true },
      { framework: 'webpack' }
    );
    if (!plugin.transformInclude || typeof plugin.transform !== 'function')
      throw new Error('Missing raw compiler hooks');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(plugin.transformInclude(filename as unknown as string)).toBe(true);
    for (const source of [null, undefined])
      expect(
        await plugin.transform.call(
          context,
          source as unknown as string,
          filename as unknown as string
        )
      ).toBeNull();
    const source = `import {jsx} from 'react/jsx-runtime'; export const Page=()=>jsx('p',{children:'Virtual automatic text'});`;
    const output = await plugin.transform.call(
      context,
      source,
      filename as unknown as string
    );
    expect(typeof output === 'string' ? output : output?.code).toContain(
      'GtInternalTranslateJsx'
    );
    expect(error).not.toHaveBeenCalled();
  }
);
