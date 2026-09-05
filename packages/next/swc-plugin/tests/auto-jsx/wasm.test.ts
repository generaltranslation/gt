import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { transformSync } from '@swc/core';
import generate from '@babel/generator';
import { canonical, lower, oracle, oracleCompiled } from './oracle';
import { loadExamples, pluginDirectory } from './workflow';

const examples = await loadExamples();
const wasm = path.join(
  pluginDirectory,
  'target/wasm32-wasip1/release/gt_swc_plugin.wasm'
);

beforeAll(() => {
  execFileSync(
    'cargo',
    [
      'build',
      '--quiet',
      '--release',
      '--target',
      'wasm32-wasip1',
      '--manifest-path',
      path.join(pluginDirectory, 'Cargo.toml'),
    ],
    { stdio: 'inherit', cwd: pluginDirectory }
  );
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
  for (const example of examples) {
    it(example.name, () => {
      expect(canonical(lower(transform(example.input)))).toBe(
        canonical(oracle(example.input))
      );
    });
  }
});

// These three sources expose upstream SWC lowering defects before the compiler
// reference would run: quoted VT/FF become literal backslash escapes, and an
// object spread containing a prototype setter is incorrectly flattened. Keep
// them in source-level parity above and assert preservation below; reproducing
// their changed input interpretation would violate the compiler's JSX rules.
const hostDefects = new Set([
  'adversarial/unicode-vertical-tab-attribute',
  'adversarial/unicode-form-feed-attribute',
  'adversarial/spread-object-opaque-proto',
]);

describe.each([false, true])(
  'SWC host JSX lowering, development=%s',
  (development) => {
    for (const example of examples.filter(
      ({ name }) => !hostDefects.has(name)
    )) {
      it(example.name, () => {
        const base = transform(example.input, false, development, 'automatic');
        const expected = oracleCompiled(base);
        const actual = transform(example.input, true, development, 'automatic');
        expect(canonical(lower(actual))).toBe(
          canonical(lower(generate(expected).code))
        );
      });
    }
  }
);

it.each([...hostDefects])(
  'preserves host data for the upstream lowering defect %s',
  (name) => {
    const input = examples.find((example) => example.name === name)!.input;
    const before = canonical(
      lower(transform(input, false, false, 'automatic'))
    );
    const after = canonical(lower(transform(input, true, false, 'automatic')));
    const preserved = name.endsWith('proto')
      ? '__proto__:prototype'
      : name.includes('vertical-tab')
        ? 'children:"\\\\v"'
        : 'children:"\\\\f"';
    expect(before).toContain(preserved);
    expect(after).toContain(preserved);
  }
);

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
