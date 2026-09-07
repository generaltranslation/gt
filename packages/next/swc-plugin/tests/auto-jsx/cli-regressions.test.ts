import { describe, expect, it } from 'vitest';
import { cliRegressionExamples } from './cli-regressions';
import { cliResult } from './cli-oracle';
import { canonicalRuntime, oracle } from './oracle';

describe('CLI/compiler insertion parity regressions', () => {
  it.each([
    '/** @jsxRuntime classic */ import React from "react";',
    '/**\n * @jsxRuntime classic\n * @jsx make\n */ import { createElement as make } from "react";',
    '/** @jsxImportSource preact */',
    '/** @jsxImportSource ./view-runtime */',
  ])('preserves the runtime selected by %s', (header) => {
    const input =
      header +
      ' export const Page = () => <p title="Account">Hello {name}</p>;';
    expect(cliResult(input).runtimeCanonical).toBe(
      canonicalRuntime(oracle(input))
    );
  });

  it.each([
    '/** @jsxImportSource preact */ export const Page = () => <p>{name}</p>;',
    '/** @jsxRuntime classic */ import React from "react"; export const Page = () => <p>{name}</p>;',
    '/** @jsxImportSource preact */\n/** @jsxImportSource react */ export const Page = () => <p>Hello {name}</p>;',
    '/** @jsxRuntime classic */\n/** @jsxRuntime automatic */ export const Page = () => <p>Hello {name}</p>;',
    'export const note = "@jsxRuntime classic"; export const Page = () => <p>Hello {name}</p>;',
  ])('resolves inactive or overridden runtime pragmas: %s', (input) => {
    expect(cliResult(input).runtimeCanonical).toBe(
      canonicalRuntime(oracle(input))
    );
  });

  it('matches callback JSX below Derive inside an opaque content prop', () => {
    const input =
      'import { Branch, Derive } from "gt-next"; export const Page = () => <p><Branch yes={<section><Derive>{() => <b>Hello {name}</b>}</Derive></section>} /></p>;';
    const control =
      'import { Derive } from "gt-next"; export const Page = () => <p><Derive>{() => <b>Hello {name}</b>}</Derive></p>;';
    expect(cliResult(input).runtimeCanonical).toBe(
      canonicalRuntime(oracle(input))
    );
    expect(cliResult(control).runtimeCanonical).toBe(
      canonicalRuntime(oracle(control))
    );
  });
  it.each(Object.entries(cliRegressionExamples))(
    '%s matches for the historical counterexample and nearby control',
    (_reason, { input, control }) => {
      expect(cliResult(input).runtimeCanonical).toBe(
        canonicalRuntime(oracle(input))
      );
      expect(cliResult(control).runtimeCanonical).toBe(
        canonicalRuntime(oracle(control))
      );
    }
  );

  it.each([
    'export const labels = ["Text", value]; export const Page = () => <p>Hello {name}</p>;',
    'export const Page = () => <p title={undefined}>Hello {name}</p>;',
    'export const Page = () => <p title={+3}>Hello {name}</p>;',
    'export const Page = () => <p>{[first, second]}</p>;',
    'export const Page = () => <p> {["Hello", name]} </p>;',
    'export const Page = () => <p title={["Hello", name]}>Text</p>;',
    'export const Page = () => <p>{<b>Hello {name}</b>}</p>;',
    'export const Page = () => <p>{undefined}</p>;',
    'export const Page = () => <p>Hello {[first, second]}</p>;',
    'import { Branch } from "gt-next"; export const Page = () => <Branch branch={mode} yes="Yes" />;',
    'import { T } from "gt-next"; export const Keep = T; export const Page = (T) => <T>{value}</T>;',
    'import { Var } from "gt-next"; export const Page = () => <Var><Card {...props} key={name} children="Hello">{["Hi", name]}</Card></Var>;',
  ])('preserves unrelated or inactive syntax: %s', (input) => {
    expect(cliResult(input).runtimeCanonical).toBe(
      canonicalRuntime(oracle(input))
    );
  });
});
