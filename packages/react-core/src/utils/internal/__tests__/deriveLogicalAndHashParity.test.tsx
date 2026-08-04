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
});
