import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { transformSync } from '@swc/core';
import generate from '@babel/generator';
import { parse } from '@babel/parser';
import * as t from '@babel/types';
import { canonicalRuntime, lower, oracle } from './oracle';
import { cliNextOutput, cliOracle, cliResult } from './cli-oracle';

function observe(code: string) {
  const require = createRequire(import.meta.url);
  const emitted = transformSync(code, {
    filename: 'input.js',
    swcrc: false,
    configFile: false,
    jsc: { target: 'esnext', parser: { syntax: 'ecmascript' } },
    module: { type: 'commonjs' },
  }).code;
  const value = runInNewContext(
    `${emitted}\n({node: exports.Page(), events: exports.events});`,
    {
      exports: {},
      require(name: string) {
        return name === 'gt-next'
          ? {
              GtInternalTranslateJsx: 'gt-translation',
              GtInternalVar: 'gt-variable',
            }
          : require(name);
      },
    }
  ) as { node: { props: { children: unknown[] } }; events: string[] };
  const children = value.node.props.children;
  return {
    frozen: Object.isFrozen(children),
    length: children.length,
    events: [...value.events],
  };
}

const childrenProps = [
  'children="Claimed"',
  'children={"Claimed"}',
  'children={["Claimed ", track("attribute")]}',
  '{...{children:["Claimed ", track("attribute")]}}',
  'children={(["Claimed ", track("attribute")] as const)}',
];

describe.each([false, true])(
  'CLI helper semantics in host development=%s',
  (development) => {
    it.each(childrenProps)(
      'retains overridden body freezing and evaluation order: %s',
      (attribute) => {
        const input = `export const events: string[] = []; const track = (value: string) => (events.push(value), value);
      export const Page = () => <p ${attribute}>Actual {/* keep empty JSX comment */} body {track('body')}</p>;`;
        const output = cliNextOutput(input);
        const expected = oracle(input, development);
        expect(cliResult(input, development).runtimeCanonical).toBe(
          canonicalRuntime(expected)
        );
        expect(generate(cliOracle(input), { comments: true }).code).toContain(
          'keep empty JSX comment'
        );
        const actualObservation = observe(
          generate(lower(output, development)).code
        );
        expect(actualObservation).toEqual(observe(generate(expected).code));
        expect(actualObservation.frozen).toBe(false);
        expect(actualObservation.events.at(-1)).toBe('body');
      }
    );
  }
);

describe.each([false, true])(
  'CLI printed pragmas in host development=%s',
  (development) => {
    it.each([
      '/** @jsxImportSource ./custom-runtime */',
      '/** @jsxImportSource @emotion/react */',
      '/**\n * Copyright retained\n * @jsxImportSource ./custom-runtime\n */',
      '/** @jsxRuntime classic */',
    ])(
      'keeps the leading runtime selector before generated imports: %s',
      (pragma) => {
        const input = `${pragma}\nimport {jsx as make} from 'react/jsx-runtime';
      export const direct = make('div', {children: ['Explicit ', value]});
      export const Page = () => <section>Selected runtime</section>;`;
        const actual = cliNextOutput(input);
        expect(actual.indexOf('@jsx')).toBeLessThan(actual.indexOf('import '));
        const sources = (code: string) => {
          const lowered = transformSync(code, {
            filename: 'input.tsx',
            swcrc: false,
            configFile: false,
            jsc: {
              target: 'esnext',
              parser: { syntax: 'typescript', tsx: true },
              transform: { react: { runtime: 'automatic', development } },
            },
            module: { type: 'es6' },
          }).code;
          return parse(lowered, { sourceType: 'module' })
            .program.body.filter(
              (statement): statement is t.ImportDeclaration =>
                t.isImportDeclaration(statement)
            )
            .map((statement) => statement.source.value)
            .filter(
              (source) => source !== 'gt-next' && source !== 'react/jsx-runtime'
            );
        };
        expect(sources(actual)).toEqual(sources(input));
      }
    );
  }
);
