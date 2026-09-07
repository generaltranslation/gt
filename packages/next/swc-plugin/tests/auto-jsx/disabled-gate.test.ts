import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { transformSync, type ReactConfig } from '@swc/core';
import {
  loadExamples,
  pluginDirectory,
  runCargo,
  yieldToRunner,
} from './workflow';

const examples = await loadExamples();

const wasm = path.join(
  pluginDirectory,
  'target/wasm32-wasip1/release/gt_swc_plugin.wasm'
);

beforeAll(async () => {
  await runCargo([
    'build',
    '--quiet',
    '--release',
    '--target',
    'wasm32-wasip1',
    '--manifest-path',
    path.join(pluginDirectory, 'Cargo.toml'),
  ]);
}, 300_000);

function transform(
  input: string,
  config: Record<string, unknown> | undefined,
  react: ReactConfig,
  filename: string | null = 'disabled-gate.tsx'
) {
  const output = transformSync(input, {
    filename: filename ?? undefined,
    swcrc: false,
    configFile: false,
    sourceMaps: true,
    jsc: {
      target: 'esnext',
      parser: { syntax: 'typescript', tsx: true, decorators: true },
      transform: { react },
      ...(config && {
        experimental: {
          cacheRoot: path.join(
            pluginDirectory,
            'target/disabled-gate-swc-cache'
          ),
          plugins: [[wasm, config] as [string, Record<string, unknown>]],
        },
      }),
    },
  });
  return { code: output.code, map: output.map };
}

const autoOnlyOptions = [
  {},
  { jsxImportSourceFromLoader: true },
  {
    jsxImportSourceFromLoader: true,
    missingJsxRuntimeContextDiagnostic: 'AUTO CONTEXT MUST NOT RUN',
  },
  { jsxRuntime: 'classic', jsxImportSource: '@emotion/react' },
  { autoJsxRuntimePackageRoots: ['/', '[project]', 'C:\\project'] },
  { jsxRuntime: 'invalid' },
  { jsxRuntime: { unexpected: true } },
  { jsxImportSource: ['react'] },
  { autoJsxRuntimePackageRoots: 42 },
  { autoJsxRuntimePackageRoots: ['/runtime', false] },
  { jsxImportSourceFromLoader: 'true' },
  { missingJsxRuntimeContextDiagnostic: { message: 'invalid' } },
] satisfies Record<string, unknown>[];

const sources = [
  `'use client'; export const Page = ({ name }) => <p>Hello {name}</p>;`,
  `import { T, Var } from 'gt-next'; export const Page = () => <><T>Manual</T><T>Hello <Var>{name}</Var></T><p>Automatic {name}</p></>;`,
  `import { useGT } from 'gt-next'; export function Page() { const gt = useGT(); return <p>{gt('Label')}{gt('Hello ' + name)}</p>; }`,
  `import { jsx as make } from 'react/jsx-runtime'; export const Page = () => make('p', {children: ['Hello ', name]});`,
  `export const Page = () => <main>Hello<style jsx>{'main{color:red}'}</style><textarea>Editor {name}</textarea></main>;`,
  `// Retain loader-looking user source\nexport const Page = () => <p>Hello</p>;\n;\n'__GT_AUTO_JSX_IMPORT_SOURCE__:react'; // EOF`,
  `import { T } from 'gt-next'; export const Page = () => <T>Manual</T>;\n;\n'__GT_AUTO_JSX_IMPORT_SOURCE__:@emotion/react';`,
];

const hosts: ReactConfig[] = [
  { runtime: 'preserve' },
  { runtime: 'automatic', development: false },
  { runtime: 'automatic', development: true },
  { runtime: 'classic', development: false },
  {
    runtime: 'automatic',
    importSource: '@emotion/react',
    development: true,
  },
];

describe('the full disabled corpus exactly preserves the unmodified host output', () => {
  const host: ReactConfig = { runtime: 'automatic', development: false };
  for (const [index, example] of examples.entries()) {
    it(example.name, async () => {
      await yieldToRunner(index);
      const expected = transform(example.input, undefined, host);
      expect(
        transform(example.input, {}, host),
        'omitted feature preserves complete code and source map'
      ).toEqual(expected);
      expect(
        transform(example.input, { enableAutoJsxInjection: false }, host),
        'explicit false preserves complete code and source map'
      ).toEqual(expected);
    });
  }
});

describe.each([false, true])(
  'disabled SWC gate, explicit false=%s',
  (explicit) => {
    for (const [hostIndex, host] of hosts.entries()) {
      for (const [sourceIndex, source] of sources.entries()) {
        it(`matches no plugin exactly, host ${hostIndex}, source ${sourceIndex}`, () => {
          const expected = transform(source, undefined, host);
          for (const options of autoOnlyOptions) {
            const config = {
              compileTimeHash: false,
              ...(explicit && { enableAutoJsxInjection: false }),
              ...options,
            };
            expect(
              transform(source, config, host),
              JSON.stringify(config)
            ).toEqual(expected);
          }
        });
      }
    }

    for (let bits = 0; bits < 16; bits++) {
      it(`preserves existing transform combination ${bits}`, () => {
        const settings = {
          logLevel: 'silent',
          compileTimeHash: Boolean(bits & 1),
          disableBuildChecks: Boolean(bits & 2),
          autoderiveJsx: Boolean(bits & 4),
          autoderiveStrings: Boolean(bits & 8),
        };
        const source = `import { T, Var, useGT } from 'gt-next'; export function Page({name}) { const gt = useGT(); return <main>Automatic <T>Manual</T><T>Hello <Var>{name}</Var></T><p>{gt('Label')}</p></main>; }`;
        const host: ReactConfig = { runtime: 'automatic', development: true };
        const expected = transform(source, settings, host);
        expect(expected.code.includes('_hash:')).toBe(settings.compileTimeHash);
        for (const options of autoOnlyOptions) {
          const config = {
            ...settings,
            ...(explicit && { enableAutoJsxInjection: false }),
            ...options,
          };
          expect(
            transform(source, config, host),
            JSON.stringify(config)
          ).toEqual(expected);
        }
      });
    }

    it('retains existing validation failures with malformed auto-only context', () => {
      const source = `import { T } from 'gt-next'; export const Page = () => <T>Hello {name}</T>;`;
      for (const options of autoOnlyOptions) {
        expect(() =>
          transform(
            source,
            {
              logLevel: 'silent',
              compileTimeHash: true,
              disableBuildChecks: false,
              ...(explicit && { enableAutoJsxInjection: false }),
              ...options,
            },
            { runtime: 'automatic' }
          )
        ).toThrow();
      }
    });

    it('does not need JSX source metadata while insertion is disabled', () => {
      const source = `export const Page = () => <p>Hello {name}</p>;`;
      const host: ReactConfig = { runtime: 'automatic', development: true };
      const config = {
        ...(explicit && { enableAutoJsxInjection: false }),
        jsxImportSourceFromLoader: true,
      };
      expect(transform(source, config, host, null)).toEqual(
        transform(source, undefined, host, null)
      );
    });
  }
);
