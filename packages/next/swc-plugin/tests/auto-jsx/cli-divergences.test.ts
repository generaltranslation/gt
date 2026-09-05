import { describe, expect, it } from 'vitest';
import {
  classifyCliDivergences,
  cliDivergenceExamples,
} from './cli-divergences';
import { cliResult } from './cli-oracle';
import { canonical, oracle } from './oracle';

describe('reviewed CLI/reference insertion disagreements', () => {
  it.each([
    '/** @jsxRuntime classic */ import React from "react";',
    '/**\n * @jsxRuntime classic\n * @jsx make\n */ import { createElement as make } from "react";',
    '/** @jsxImportSource preact */',
    '/** @jsxImportSource ./view-runtime */',
  ])('classifies the actual lowered runtime selected by %s', (header) => {
    const input =
      header +
      ' export const Page = () => <p title="Account">Hello {name}</p>;';
    expect(classifyCliDivergences(input)).toContain('jsx-runtime');
    expect(cliResult(input).canonical).not.toBe(canonical(oracle(input)));
  });

  it.each([
    '/** @jsxImportSource preact */ export const Page = () => <p>{name}</p>;',
    '/** @jsxRuntime classic */ import React from "react"; export const Page = () => <p>{name}</p>;',
    '/** @jsxImportSource preact */\n/** @jsxImportSource react */ export const Page = () => <p>Hello {name}</p>;',
    '/** @jsxRuntime classic */\n/** @jsxRuntime automatic */ export const Page = () => <p>Hello {name}</p>;',
    'export const note = "@jsxRuntime classic"; export const Page = () => <p>Hello {name}</p>;',
  ])('does not classify an inactive or overridden JSX runtime: %s', (input) => {
    expect(classifyCliDivergences(input)).not.toContain('jsx-runtime');
    expect(cliResult(input).canonical).toBe(canonical(oracle(input)));
  });

  it('identifies callback JSX below Derive inside an opaque content prop', () => {
    const input =
      'import { Branch, Derive } from "gt-next"; export const Page = () => <p><Branch yes={<section><Derive>{() => <b>Hello {name}</b>}</Derive></section>} /></p>;';
    const control =
      'import { Derive } from "gt-next"; export const Page = () => <p><Derive>{() => <b>Hello {name}</b>}</Derive></p>;';
    expect(classifyCliDivergences(input)).toContain('derive-children');
    expect(cliResult(input).canonical).not.toBe(canonical(oracle(input)));
    expect(classifyCliDivergences(control)).not.toContain('derive-children');
    expect(cliResult(control).canonical).toBe(canonical(oracle(control)));
  });
  it.each(Object.entries(cliDivergenceExamples))(
    '%s has a minimal counterexample and agreeing control',
    (reason, { input, control }) => {
      expect(classifyCliDivergences(input)).toContain(reason);
      expect(cliResult(input).canonical).not.toBe(canonical(oracle(input)));
      expect(classifyCliDivergences(control)).not.toContain(reason);
      expect(cliResult(control).canonical).toBe(canonical(oracle(control)));
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
  ])('does not classify unrelated or inactive syntax: %s', (input) => {
    expect(classifyCliDivergences(input)).toEqual([]);
    expect(cliResult(input).canonical).toBe(canonical(oracle(input)));
  });
});
