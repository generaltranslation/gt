import { describe, expect, it } from 'vitest';
import { cliOracle, cliOutput, cliResult } from './cli-oracle';
import { canonical, lower, oracle } from './oracle';

describe('CLI auto JSX oracle', () => {
  it.each([
    'export const Page = () => <p>Hello {name}</p>;',
    'export const Page = () => <main>Before <b>Nested {name}</b> after</main>;',
    'export const Page = () => <div>{show ? <b>Hello {name}</b> : null}</div>;',
    'import { T, Var } from "gt-next"; export const Page = () => <T>Hello <Var>{name}</Var></T>;',
    'import { T, Var } from "gt-i18n"; export const Page = () => <T>Hello <Var>{name}</Var></T>;',
    'import { Branch } from "gt-next"; export const Page = () => <div><Branch branch={mode} yes={name}>Other {value}</Branch></div>;',
  ])('agrees on shared insertion behavior: %s', (input) => {
    expect(cliResult(input).canonical).toBe(canonical(oracle(input)));
    expect(cliResult(input, true).canonical).toBe(
      canonical(oracle(input, true))
    );
  });

  it('retains the actual CLI helper imports in the raw golden', () => {
    const input = 'export const Page = () => <p>Hello {name}</p>;';
    const result = cliResult(input);
    expect(result.output).toBe(cliOutput(input));
    expect(result.output).toContain('from "gt-react"');
    expect(result.output).not.toContain('from "gt-next"');
    expect(result.canonical).toContain('$gtParityGtInternalTranslateJsx');
    expect(result.canonical).toContain('$gtParityGtInternalVar');
    expect(cliOracle(input).program.body[0].type).toBe('ImportDeclaration');
  });

  it.each([
    'import { T } from "gt-react"; export const Page = () => <main><T>Manual</T><p>New {name}</p></main>;',
    'import { GtInternalTranslateJsx as Existing } from "gt-react"; export const Page = () => <Existing>Existing {name}</Existing>;',
    'import * as GT from "gt-react"; export const Page = () => <GT.T>Namespace {name}</GT.T>;',
    'import Component from "gt-react"; export const Page = () => <Component>Default {name}</Component>;',
    'import "gt-react"; export const Page = () => <p>New {name}</p>;',
  ])('preserves original gt-react imports: %s', (input) => {
    expect(cliResult(input).canonical).toContain('"gt-react"');
  });

  it('does not expand macros, derive values, or inject hashes', () => {
    const input =
      'import { t } from "gt-next"; export const value = t`Hello ${name}`;';
    const result = cliResult(input);
    expect(result.canonical).toBe(canonical(lower(input)));
    expect(result.output).not.toContain('_hash');
  });
});
