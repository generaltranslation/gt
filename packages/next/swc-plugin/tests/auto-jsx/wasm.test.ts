import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { transformSync, type ReactConfig } from '@swc/core';
import generate from '@babel/generator';
import { parse } from '@babel/parser';
import {
  canonical,
  lower,
  oracle,
  oracleCompiled,
  readableOutput,
} from './oracle';
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
  enabled = true,
  development = false,
  runtime: 'preserve' | 'automatic' = 'preserve'
): string {
  return transformWithHost(input, enabled, { runtime, development });
}

function transformWithHost(
  input: string,
  enabled: boolean,
  react: ReactConfig,
  pluginConfig: Record<string, unknown> = {}
): string {
  return transformSync(input, {
    filename: 'input.tsx',
    swcrc: false,
    configFile: false,
    jsc: {
      parser: { syntax: 'typescript', tsx: true, decorators: true },
      target: 'esnext',
      transform: {
        react,
        // This path deliberately preserves JSX for the shared Babel lowering.
        // Retain value imports used by classic factory pragmas until that step;
        // automatic/classic host comparisons use the host's normal TS stripping.
        ...(react.runtime === 'preserve' && { verbatimModuleSyntax: true }),
      },
      experimental: {
        cacheRoot: path.join(pluginDirectory, 'target/auto-jsx-swc-cache'),
        plugins: [
          [
            wasm,
            {
              enableAutoJsxInjection: enabled,
              compileTimeHash: false,
              jsxImportSource: react.importSource,
              jsxRuntime: react.runtime === 'classic' ? 'classic' : 'automatic',
              ...pluginConfig,
            },
          ],
        ],
      },
    },
  }).code;
}

describe('distributed WASM plugin matches the compiler', () => {
  for (const [index, example] of examples.entries()) {
    it(example.name, async () => {
      await yieldToRunner(index);
      expect(canonical(lower(transform(example.input)))).toBe(
        canonical(oracle(example.input))
      );
    });
  }
});

// SWC turns quoted VT/FF into literal backslash escapes before the compiler
// reference would run. Keep source-level parity above and data preservation
// below; reproducing that changed input would violate the compiler's JSX rules.
const quotedControlHostDefects = new Set([
  'adversarial/unicode-vertical-tab-attribute',
  'adversarial/unicode-form-feed-attribute',
]);

// SWC incorrectly flattens an object spread containing a prototype setter,
// changing which duplicate children property the compiler sees first. For these
// sources, inject the compiler reference before the same host lowering. Compare
// the entire output in both modes so wrapper ownership and host behavior remain
// checked without teaching the insertion pass that upstream interpretation.
const prototypeSpreadHostDefects = new Set([
  'adversarial/spread-object-opaque-proto',
  ...examples
    .filter(
      ({ name }) =>
        name.startsWith(
          'interaction-pages/nested-spreads-prototype-boundary-'
        ) && name.endsWith('-parameter-shadow-server')
    )
    .map(({ name }) => name),
]);

describe.each([false, true])(
  'SWC host JSX lowering, development=%s',
  (development) => {
    for (const [index, example] of examples
      .filter(({ name }) => !quotedControlHostDefects.has(name))
      .entries()) {
      it(example.name, async () => {
        await yieldToRunner(index);
        const expected = prototypeSpreadHostDefects.has(example.name)
          ? transform(
              readableOutput(oracle(example.input)),
              false,
              development,
              'automatic'
            )
          : generate(
              oracleCompiled(
                transform(example.input, false, development, 'automatic')
              )
            ).code;
        const actual = transform(example.input, true, development, 'automatic');
        expect(canonical(lower(actual))).toBe(canonical(lower(expected)));
      });
    }
  }
);

it.each([
  ...quotedControlHostDefects,
  'adversarial/spread-object-opaque-proto',
])('preserves host data for the upstream lowering defect %s', (name) => {
  const input = examples.find((example) => example.name === name)!.input;
  const before = canonical(lower(transform(input, false, false, 'automatic')));
  const after = canonical(lower(transform(input, true, false, 'automatic')));
  const preserved = name.endsWith('proto')
    ? '__proto__:prototype'
    : name.includes('vertical-tab')
      ? 'children:"\\\\v"'
      : 'children:"\\\\f"';
  expect(before).toContain(preserved);
  expect(after).toContain(preserved);
});

it.each([false, true])(
  'lets the host lower inserted wrappers in development=%s',
  (development) => {
    const input =
      '"use client"; export const Page = () => <main>Hello {name}!<p>Status: {ready ? <b>Ready</b> : <i>Waiting</i>}</p></main>;';
    expect(
      canonical(lower(transform(input, true, development, 'automatic')))
    ).toBe(canonical(oracle(input)));
    const unchanged = transform(input, false, development, 'automatic');
    expect(canonical(lower(unchanged))).toBe(canonical(lower(input)));
  }
);

// Compare with the compiler after this exact host has interpreted its JSX
// options and comments. Babel and SWC differ on which comments are directives;
// those host choices must not be hidden by the source-level oracle.
const runtimePages = [
  'export const Page = () => <p>Hello {name}<strong>Nested copy</strong></p>;',
  'export const Page = () => <><h1>Account {name}</h1>{ready ? <p>Ready now</p> : <aside>Waiting</aside>}</>;',
  'export const Page = ({ items }: { items: string[] }) => <main>{items.map((item) => <article key={item}>Item {item}</article>)}</main>;',
];
const runtimeDirectives = [
  ['default', ''],
  ['react', '/** @jsxImportSource react */'],
  ['emotion', '/** @jsxImportSource @emotion/react */'],
  ['preact', '/** @jsxImportSource preact */'],
  ['automatic', '/** @jsxRuntime automatic */'],
  ['classic', '/** @jsxRuntime classic */'],
  [
    'classic-factory',
    '/** @jsxRuntime classic @jsx h @jsxFrag React.Fragment */',
  ],
  ['line-comment', '// @jsxImportSource preact'],
  ['inline-prose', '/* Example: @jsxImportSource preact */'],
  ['multiline', '/**\n * @jsxImportSource preact\n */'],
  [
    'last-source-in-comment',
    '/** @jsxImportSource preact @jsxImportSource react */',
  ],
  [
    'last-runtime-in-comment',
    '/** @jsxRuntime classic @jsxRuntime automatic */',
  ],
  [
    'multiple-comments',
    '/** @jsxImportSource preact */\n/** @jsxImportSource react */',
  ],
  [
    'import-source-after-classic',
    '/** @jsxRuntime classic @jsxImportSource react */',
  ],
] as const;

describe.each([false, true])(
  'effective host runtime, development=%s',
  (development) => {
    for (const importSource of ['react', '@emotion/react', 'preact']) {
      for (const [directive, comment] of runtimeDirectives) {
        for (const [page, source] of runtimePages.entries()) {
          it(`${importSource}/${directive}/page-${page}`, () => {
            const input = `${comment}\nimport * as React from 'react'; import { h } from 'preact';\n${source}`;
            const react: ReactConfig = {
              runtime: 'automatic',
              importSource,
              development,
            };
            const baseline = transformWithHost(input, false, react);
            const expected = canonical(oracleCompiled(baseline));
            const actual = transformWithHost(input, true, react);
            expect(canonical(parse(actual, { sourceType: 'module' }))).toBe(
              expected
            );
          });
        }
      }
    }

    it('respects a configured classic runtime', () => {
      const input = `import * as React from 'react'; ${runtimePages[0]}`;
      const react: ReactConfig = { runtime: 'classic', development };
      const baseline = transformWithHost(input, false, react);
      const actual = transformWithHost(input, true, react);
      expect(actual).not.toContain('GtInternalTranslateJsx');
      expect(canonical(parse(actual, { sourceType: 'module' }))).toBe(
        canonical(oracleCompiled(baseline))
      );
    });

    it('preserves manual hashing with a custom automatic runtime', () => {
      const input = `import { T } from 'gt-next'; export const Page = () => <main>Automatic text<T>Manual translation</T></main>;`;
      const react: ReactConfig = {
        runtime: 'automatic',
        importSource: '@emotion/react',
        development,
      };
      const config = { compileTimeHash: true };
      const baseline = transformWithHost(input, false, react, config);
      const actual = transformWithHost(input, true, react, config);
      expect(actual).toContain('_hash:');
      expect(actual).not.toContain('GtInternalTranslateJsx');
      expect(canonical(lower(actual))).toBe(canonical(lower(baseline)));
    });
  }
);

describe.each([false, true])(
  'Emotion loader runtime context, development=%s',
  (development) => {
    for (const importSource of ['react', '@emotion/react']) {
      for (const [name, comment] of runtimeDirectives.slice(0, 7)) {
        it(`${importSource}/${name}`, () => {
          const source = `${comment}\n'use client'; import * as React from 'react'; import { h } from 'preact'; ${runtimePages[0]}`;
          const input = `${source}\n;\n"__GT_AUTO_JSX_IMPORT_SOURCE__:${importSource}";\n`;
          const react: ReactConfig = {
            runtime: 'automatic',
            importSource,
            development,
          };
          const config = {
            jsxImportSource: undefined,
            jsxImportSourceFromLoader: true,
          };
          const baseline = transformWithHost(source, false, react);
          const actual = transformWithHost(input, true, react, config);
          expect(actual).not.toContain('__GT_AUTO_JSX_IMPORT_SOURCE__');
          expect(canonical(parse(actual, { sourceType: 'module' }))).toBe(
            canonical(oracleCompiled(baseline))
          );
          expect(
            canonical(
              parse(transformWithHost(input, false, react, config), {
                sourceType: 'module',
              })
            )
          ).toBe(canonical(parse(baseline, { sourceType: 'module' })));
        });
      }
    }
  }
);

it('does not consume ordinary user marker strings without loader context', () => {
  const input = `export const answer = 42;\n;\n"__GT_AUTO_JSX_IMPORT_SOURCE__:react";\n`;
  const actual = transformWithHost(input, true, { runtime: 'automatic' });
  expect(canonical(lower(actual))).toBe(canonical(lower(input)));
});

it.each([
  '',
  '\n;\n"__GT_AUTO_JSX_IMPORT_SOURCE__:unexpected-runtime";\n',
  '\n;\n"__GT_AUTO_JSX_IMPORT_SOURCE__:react";\nexport const after = 1;',
])('rejects missing or invalid required loader context: %s', (suffix) => {
  expect(() =>
    transformWithHost(
      `${runtimePages[0]}${suffix}`,
      true,
      {
        runtime: 'automatic',
      },
      { jsxImportSourceFromLoader: true }
    )
  ).toThrow();
});
