import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { transformSync } from '@swc/core';
import generate from '@babel/generator';
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
  return transformSync(input, {
    filename: 'input.tsx',
    swcrc: false,
    configFile: false,
    jsc: {
      parser: { syntax: 'typescript', tsx: true, decorators: true },
      target: 'esnext',
      transform: { react: { runtime, development } },
      experimental: {
        cacheRoot: path.join(pluginDirectory, 'target/auto-jsx-swc-cache'),
        plugins: [
          [wasm, { enableAutoJsxInjection: enabled, compileTimeHash: false }],
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
