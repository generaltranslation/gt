import path from 'node:path';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { beforeAll, describe, expect, it } from 'vitest';
import { parse } from '@babel/parser';
import { transformSync } from '@swc/core';
import { canonicalRuntime, oracleCompiled } from './oracle';
import { examples } from './cases/runtime-calls';
import { assertedRuntimeCalleeExamples } from './runtime-scope-inputs';
import { pluginDirectory, runCargo } from './workflow';

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
  ]);
}, 300_000);

function transform(
  input: string,
  enabled: boolean,
  development: boolean,
  compileTimeHash = false,
  packageScope?: { filename: string; roots: string[] }
): string {
  return transformSync(input, {
    filename: packageScope?.filename ?? 'input.tsx',
    swcrc: false,
    configFile: false,
    jsc: {
      parser: { syntax: 'typescript', tsx: true },
      target: 'esnext',
      transform: { react: { runtime: 'automatic', development } },
      experimental: {
        cacheRoot: path.join(pluginDirectory, 'target/auto-jsx-swc-cache'),
        plugins: [
          [
            wasm,
            {
              enableAutoJsxInjection: enabled,
              compileTimeHash,
              disableBuildChecks: false,
              ...(packageScope && {
                autoJsxRuntimePackageRoots: packageScope.roots,
              }),
            },
          ],
        ],
      },
    },
  }).code;
}

function observedName(source: string): string {
  const require = createRequire(import.meta.url);
  const emitted = transformSync(source, {
    filename: 'input.js',
    swcrc: false,
    configFile: false,
    jsc: { parser: { syntax: 'ecmascript' }, target: 'esnext' },
    module: { type: 'commonjs' },
  }).code;
  return runInNewContext(`${emitted}\nexports.Page().name;`, {
    exports: {},
    require(name: string) {
      return name === 'gt-next'
        ? {
            GtInternalTranslateJsx: 'gt-translation',
            GtInternalVar: 'gt-variable',
          }
        : require(name);
    },
  }) as string;
}

const automaticCases = [
  ['sparse arrays', `export const Page=()=> <p>{['Sparse ', , label]}</p>;`],
  ['spread arrays', `export const Page=()=> <p>{['Spread ', ...items]}</p>;`],
  [
    'nested arrays',
    `export const Page=()=> <p>{['Nested ', [label, other]]}</p>;`,
  ],
  [
    'mixed runtime calls',
    `import {jsx as make} from 'react/jsx-runtime'; export const Page=()=> <main>Before {make('p',{children:['Mixed ',label]})}</main>;`,
  ],
  [
    'styled JSX',
    `export const Page=()=> <section>Before<style jsx>{'section{color:red}'}</style>After {label}</section>;`,
  ],
  [
    'protected text payloads',
    `export const Page=()=> <main>Before<title>{label}</title><textarea>{label}</textarea><script>{'window.ok=true'}</script>After {label}</main>;`,
  ],
] as const;

const manualCases = [
  [
    'manual JSX',
    `import {T,Var} from 'gt-next'; export const Page=()=> <main><T>Hello <Var>{label}</Var></T><p>Automatic {label}</p></main>;`,
  ],
  [
    'manual strings',
    `import {useGT} from 'gt-next'; export const Page=()=> {const t=useGT(); return <main>{t('Manual string')}<p>Automatic {label}</p></main>;};`,
  ],
] as const;

function hashes(source: string): string[] {
  return Array.from(
    source.matchAll(/_hash["']?\s*[:=]\s*["']([^"']+)["']/g),
    (match) => match[1]
  );
}

describe.each([false, true])(
  'runtime semantics (development=%s)',
  (development) => {
    it.each([
      ['/runtime/gt-next/dist/Branch.mjs', '/runtime/gt-next'],
      ['/runtime/gt-next/dist/Branch.mjs?server', '/runtime/gt-next/'],
      [
        '/runtime/gt-next/dist/Branch.mjs?loader=/node_modules/other',
        '/runtime/gt-next',
      ],
      ['C:\\runtime\\gt-next\\dist\\Branch.mjs', 'C:/runtime/gt-next'],
    ])('keeps GT runtime implementation %s uninjected', (filename, root) => {
      const input = `import {jsx as make} from 'react/jsx-runtime'; import {Branch} from 'gt-react'; export const Wrapper=()=>make(Branch,{...props});`;
      const scope = { filename, roots: [root] };
      const baseline = transform(input, false, development, false, scope);
      const output = transform(input, true, development, false, scope);
      expect(output).not.toContain('GtInternalTranslateJsx');
      expect(canonicalRuntime(parse(output, { sourceType: 'module' }))).toBe(
        canonicalRuntime(parse(baseline, { sourceType: 'module' }))
      );
    });

    it.each([
      '/runtime/gt-next-user/Page.tsx',
      '/runtime/gt-next/node_modules/user-cards/Page.tsx',
    ])('keeps other package file %s eligible for insertion', (filename) => {
      const output = transform(
        'export const Page=()=> <p>Visible text</p>;',
        true,
        development,
        false,
        {
          filename,
          roots: ['/runtime/gt-next'],
        }
      );
      expect(output).toContain('GtInternalTranslateJsx');
    });

    it.each(manualCases)(
      'keeps %s hashing inside an excluded runtime',
      (_name, input) => {
        const scope = {
          filename: '/runtime/gt-next/dist/Wrapper.tsx',
          roots: ['/runtime/gt-next'],
        };
        const baseline = transform(input, false, development, true, scope);
        const output = transform(input, true, development, true, scope);
        expect(output).not.toContain('GtInternalTranslateJsx');
        expect(hashes(baseline).length).toBeGreaterThan(0);
        expect(hashes(output)).toEqual(hashes(baseline));
      }
    );

    for (const example of assertedRuntimeCalleeExamples) {
      it(`matches the exact host baseline for ${example.name}`, () => {
        const baseline = transform(example.input, false, development);
        const output = transform(example.input, true, development);
        expect(canonicalRuntime(parse(output, { sourceType: 'module' }))).toBe(
          canonicalRuntime(oracleCompiled(baseline))
        );
      });
    }

    for (const example of examples.filter((example) =>
      /\/shadowed-(single|multi)-(function|arrow|class)-name$/.test(
        example.name
      )
    )) {
      it(`preserves the observable name in ${example.name}`, () => {
        const baseline = transform(example.input, false, development);
        const output = transform(example.input, true, development);
        expect(observedName(output)).toBe(observedName(baseline));
        expect(canonicalRuntime(parse(output, { sourceType: 'module' }))).toBe(
          canonicalRuntime(oracleCompiled(baseline))
        );
      });
    }

    it.each(automaticCases)(
      'keeps %s with hashing and build checks enabled',
      (_name, input) => {
        const output = transform(input, true, development, true);
        const insertionOnly = transform(input, true, development, false);
        expect(output).toContain('GtInternalTranslateJsx');
        expect(canonicalRuntime(parse(output, { sourceType: 'module' }))).toBe(
          canonicalRuntime(parse(insertionOnly, { sourceType: 'module' }))
        );
      }
    );

    it.each(manualCases)(
      'preserves hashes for %s alongside automatic regions',
      (_name, input) => {
        const baseline = transform(input, false, development, true);
        const output = transform(input, true, development, true);
        expect(output).toContain('GtInternalTranslateJsx');
        expect(hashes(baseline).length).toBeGreaterThan(0);
        expect(hashes(output)).toEqual(hashes(baseline));
      }
    );
  }
);
