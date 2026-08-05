import { it, expect, describe } from 'vitest';
import type { ReactElement, ReactNode } from 'react';
import { addGTIdentifier } from '../addGTIdentifier';
import { writeChildrenAsObjects } from '../writeChildrenAsObjects';
import { removeInjectedT } from '../removeInjectedT';
import { Derive } from '../../../components/derivation/Derive';
import { hashSource } from 'generaltranslation/id';
import type { JsxChildren } from '@generaltranslation/format/types';

// Mirrors prepareT.shared.ts: the pipeline the runtime uses to compute the
// lookup hash for a <T> component's children
function runtimeHash(children: ReactNode): string {
  const source = writeChildrenAsObjects(
    addGTIdentifier(removeInjectedT(children))
  );
  return hashSource({ source, dataFormat: 'JSX' });
}

// Mirrors extraction/postProcess.ts calculateHashes in the CLI
function cliHash(source: JsxChildren): string {
  return hashSource({ source, dataFormat: 'JSX' });
}

function childrenOf(element: ReactElement): ReactNode {
  return (element as ReactElement<{ children: ReactNode }>).props.children;
}

/**
 * The CLI derives `cond && content` inside <Derive> into two entries: the
 * right-hand content, and an empty (null) branch. At runtime the falsy case
 * leaves `false` (not null) as the Derive children, so these tests pin that
 * both serialize identically and the registered hashes match what the
 * runtime looks up.
 *
 * The CLI_* sources are the exact extraction outputs asserted in
 * packages/cli/src/react/jsx/utils/jsxParsing/__tests__/deriveLogicalExpression.test.ts
 * for <T>Hello<Derive>{show && <li>Extra item</li>}</Derive></T> and
 * <T>Hello<Derive>prefix {cond && "x"}</Derive></T>.
 */
describe('<Derive> logical && hash parity with the CLI', () => {
  const CLI_CONTENT_SOURCE = [
    'Hello',
    { t: 'Derive', i: 1, c: { t: 'li', i: 2, c: 'Extra item' } },
  ] as JsxChildren;
  const CLI_EMPTY_SOURCE = ['Hello', { t: 'Derive', i: 1 }] as JsxChildren;

  function tChildren(show: boolean): ReactNode {
    return childrenOf(
      <>
        Hello
        <Derive>{show && <li>Extra item</li>}</Derive>
      </>
    );
  }

  it('falsy && at runtime hashes to the CLI empty-branch entry', () => {
    expect(runtimeHash(tChildren(false))).toBe(cliHash(CLI_EMPTY_SOURCE));
  });

  it('truthy && at runtime hashes to the CLI content-branch entry', () => {
    expect(runtimeHash(tChildren(true))).toBe(cliHash(CLI_CONTENT_SOURCE));
  });

  it('empty and content branches hash differently', () => {
    expect(cliHash(CLI_EMPTY_SOURCE)).not.toBe(cliHash(CLI_CONTENT_SOURCE));
  });

  it('false (from &&) and null (from ternaries) children hash identically', () => {
    const withFalse = (
      <>
        Hello
        <Derive>{false}</Derive>
      </>
    );
    const withNull = (
      <>
        Hello
        <Derive>{null}</Derive>
      </>
    );
    expect(runtimeHash(childrenOf(withFalse))).toBe(
      runtimeHash(childrenOf(withNull))
    );
  });

  it('falsy && beside static sibling content matches the CLI-filtered source', () => {
    const runtimeChildren = childrenOf(
      <>
        Hello
        <Derive>prefix {false}</Derive>
      </>
    );
    // CLI empty variant keeps the static sibling and filters out the null
    const cliSource = [
      'Hello',
      { t: 'Derive', i: 1, c: ['prefix '] },
    ] as JsxChildren;
    expect(runtimeHash(runtimeChildren)).toBe(cliHash(cliSource));
  });

  // `cond && x` returns the left operand when falsy, so at runtime the Derive
  // children can be any falsy value, not just false. As the sole child, every
  // falsy value fails the props.children truthiness checks in addGTIdentifier
  // and writeChildrenAsObjects, so `c` is omitted and the hash matches the
  // registered empty branch — even for 0 and NaN, which React would render
  it.each([
    ['false', false],
    ['null', null],
    ['undefined', undefined],
    ['zero', 0],
    ['empty string', ''],
    ['NaN', NaN],
  ])(
    'sole-child falsy guard result (%s) hashes to the CLI empty-branch entry',
    (_label, value) => {
      const runtimeChildren = childrenOf(
        <>
          Hello
          <Derive>{value as ReactNode}</Derive>
        </>
      );
      expect(runtimeHash(runtimeChildren)).toBe(cliHash(CLI_EMPTY_SOURCE));
    }
  );

  // KNOWN LIMITATION: beside sibling content, falsy-but-renderable guard
  // results ('' stays in the runtime children array; 0/NaN serialize as
  // "0"/"NaN") do not match either registered variant, so lookup falls back
  // to the untranslated source. This mirrors React's own guidance against
  // non-boolean && guards; guards must be falsy-safe (boolean/null/undefined)
  // when the Derive has sibling content. If serialization of falsy children
  // is ever normalized, update these expectations.
  it.each([
    ['zero', 0],
    ['empty string', ''],
    ['NaN', NaN],
  ])(
    'sibling-content non-boolean falsy guard (%s) misses both registered variants',
    (_label, value) => {
      const runtimeChildren = childrenOf(
        <>
          Hello
          <Derive>prefix {value as ReactNode}</Derive>
        </>
      );
      const cliEmptySource = [
        'Hello',
        { t: 'Derive', i: 1, c: ['prefix '] },
      ] as JsxChildren;
      const cliContentSource = [
        'Hello',
        { t: 'Derive', i: 1, c: ['prefix ', 'x'] },
      ] as JsxChildren;
      expect(runtimeHash(runtimeChildren)).not.toBe(cliHash(cliEmptySource));
      expect(runtimeHash(runtimeChildren)).not.toBe(cliHash(cliContentSource));
    }
  );
});
