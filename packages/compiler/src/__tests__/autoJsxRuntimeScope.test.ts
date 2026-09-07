import { describe, expect, it } from 'vitest';
import type { UnpluginBuildContext, UnpluginContext } from 'unplugin';
import { hashSource } from 'generaltranslation/id';
import gtUnplugin from '../index';
import { initializeState } from '../state/utils/initializeState';
import { isAutoJsxRuntimeResource } from '../processing/jsx-insertion/runtimePackageScope';

const roots = [
  '/workspace/node_modules/gt-next',
  '/store/gt-react',
  'C:\\app\\react-core',
  '/work?tree/gt-next',
];

describe('adapter runtime package scope excludes only automatic JSX insertion', () => {
  it.each([
    undefined,
    null,
    'next-flight-client-entry-loader!',
    'next-client-pages-loader!',
  ])('handles a virtual loader without a resource filename: %s', (filename) => {
    expect(isAutoJsxRuntimeResource(filename, roots)).toBe(false);
  });
  it.each([null, undefined])(
    'ignores a virtual module whose source is %s',
    async (source) => {
      const plugin = gtUnplugin.raw(
        { enableAutoJsxInjection: true, autoJsxRuntimePackageRoots: roots },
        { framework: 'webpack' }
      );
      if (typeof plugin.transform !== 'function')
        throw new Error('Missing transform hook');
      const result = await plugin.transform.call(
        {} as UnpluginBuildContext & UnpluginContext,
        source as unknown as string,
        undefined as unknown as string
      );
      expect(result).toBeNull();
    }
  );
  it.each([
    ['/workspace/node_modules/gt-next/dist/branches/Branch.mjs', false],
    ['/workspace/node_modules/gt-next/dist/index.js?server#resource', false],
    ['/store/gt-react/dist/index.js', false],
    ['C:\\app\\react-core\\dist\\index.js', false],
    ['C:/app/react-core/dist/index.js?server', false],
    ['/work?tree/gt-next/dist/index.js', false],
    ['/workspace/node_modules/gt-next-extra/Page.tsx', true],
    ['/store/gt-reactive/Page.tsx', true],
    ['/app/src/gt-next/Page.tsx', true],
    ['/app/src/Page.tsx?root=/store/gt-react', true],
    ['/workspace/node_modules/user-library/Page.tsx', true],
    ['/workspace/node_modules/gt-next/node_modules/user-cards/Page.tsx', true],
    [
      '/workspace/node_modules/gt-next/dist/Branch.mjs?loader=/node_modules/extra',
      false,
    ],
    ['', true],
  ])('classifies %s', (filename, enabled) => {
    const state = initializeState(
      {
        enableAutoJsxInjection: true,
        autoJsxRuntimePackageRoots: roots,
        compileTimeHash: true,
        enableMacroTransform: true,
        disableBuildChecks: false,
      },
      filename as string
    );
    expect(state.settings.enableAutoJsxInjection).toBe(enabled);
    expect(state.settings.compileTimeHash).toBe(true);
    expect(state.settings.enableMacroTransform).toBe(true);
    expect(state.settings.disableBuildChecks).toBe(false);
  });

  it('can independently exclude a verified nested runtime dependency', () => {
    const state = initializeState(
      {
        enableAutoJsxInjection: true,
        autoJsxRuntimePackageRoots: [
          ...roots,
          '/workspace/node_modules/gt-next/node_modules/gt-react',
        ],
      },
      '/workspace/node_modules/gt-next/node_modules/gt-react/dist/index.js'
    );
    expect(state.settings.enableAutoJsxInjection).toBe(false);
  });

  it('keeps manual JSX and string hashes active inside a verified runtime directory', async () => {
    const plugin = gtUnplugin.raw(
      {
        enableAutoJsxInjection: true,
        autoJsxRuntimePackageRoots: roots,
        compileTimeHash: true,
        enableMacroTransform: false,
        logLevel: 'silent',
      },
      { framework: 'webpack' }
    );
    if (typeof plugin.transform !== 'function')
      throw new Error('Missing transform hook');
    const context = {
      addWatchFile() {},
      emitFile() {},
      getWatchFiles: () => [],
      warn() {},
      error(message: unknown) {
        throw new Error(String(message));
      },
      parse() {
        throw new Error('Unexpected parser use');
      },
    } as UnpluginBuildContext & UnpluginContext;
    const result = await plugin.transform.call(
      context,
      `import {jsx} from 'react/jsx-runtime'; import {T,useGT} from 'gt-next';
      export const Page=()=>[jsx(T,{children:'Manual preserved'}),jsx('p',{children:'Runtime implementation'})];
      const gt=useGT(); export const message=gt('String preserved');`,
      '/workspace/node_modules/gt-next/dist/test.js'
    );
    const code = typeof result === 'string' ? result : result?.code;
    expect(code).toContain(
      hashSource({ source: 'Manual preserved', dataFormat: 'JSX' })
    );
    expect(code).toContain(
      hashSource({ source: 'String preserved', dataFormat: 'ICU' })
    );
    expect(code).not.toContain('GtInternalTranslateJsx');
  });
});
