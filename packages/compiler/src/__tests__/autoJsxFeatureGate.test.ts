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

async function transform(
  driver: Driver,
  input: string,
  options: GTUnpluginOptions,
  filename = '/workspace/src/Page.tsx'
) {
  const resolved = { gtConfig: {}, logLevel: 'silent' as const, ...options };
  const plugin =
    driver === 'raw'
      ? gtUnplugin.raw(resolved, { framework: 'webpack' })
      : gtUnplugin[driver](resolved);
  const hook =
    typeof plugin.transform === 'function'
      ? plugin.transform
      : plugin.transform?.handler;
  if (!hook) throw new Error('Missing public compiler transform');
  const result = await hook.call(context, input, filename);
  return typeof result === 'string' ? result : (result?.code ?? null);
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
