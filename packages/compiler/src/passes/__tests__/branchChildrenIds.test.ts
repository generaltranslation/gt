/**
 * JSX ids must match the runtime's addGTIdentifier numbering, which keeps a
 * shared counter through Branch/Plural children. Branch props start their own
 * counter from the branching element's id. Element ids are not hashed, but
 * variable keys (_gt_value_<id>) are, so these cases end in a variable.
 *
 * https://github.com/generaltranslation/gt/issues/2449
 */
import { describe, it, expect } from 'vitest';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import type { JsxChildren } from '@generaltranslation/format/types';
import { collectionPass } from '../collectionPass';
import { injectionPass } from '../injectionPass';
import { initializeState } from '../../state/utils/initializeState';
import hashSource from '../../utils/calculateHash';

function transform(code: string): { code: string; errors: string[] } {
  const state = initializeState({}, 'test.tsx');
  const ast = parser.parse(code, {
    sourceType: 'module',
    plugins: ['typescript'],
  });

  traverse(ast, collectionPass(state));
  const errors = state.errorTracker.getErrors();
  if (errors.length > 0) {
    return { code, errors };
  }
  if (state.stringCollector.hasContent()) {
    traverse(ast, injectionPass(state));
  }
  return { code: generate(ast).code, errors };
}

function expectHash(code: string, source: JsxChildren) {
  const result = transform(code);
  expect(result.errors).toHaveLength(0);
  expect(result.code).toContain(
    `_hash: "${hashSource({ source, dataFormat: 'JSX' })}"`
  );
}

const pluralWithNumChild = {
  t: 'Plural',
  i: 1,
  d: { b: { one: 'one bottle' }, t: 'p' as const },
  c: [{ i: 2, k: '_gt_n_2', v: 'n' as const }, ' bottles'],
};

describe('JSX ids after Branch/Plural element children', () => {
  it('numbers an element after Plural children like the runtime', () => {
    // SOURCE: <T><Plural n={2} one="one bottle"><Num>{2}</Num> bottles</Plural><Var>{name}</Var></T>
    expectHash(
      `
        import { jsx, jsxs } from 'react/jsx-runtime';
        import { T, Plural, Num, Var } from 'gt-react';
        jsxs(T, { children: [
          jsxs(Plural, { n: 2, one: "one bottle", children: [jsx(Num, { children: 2 }), " bottles"] }),
          jsx(Var, { children: name }),
        ] });
      `,
      [pluralWithNumChild, { i: 3, k: '_gt_value_3', v: 'v' }]
    );
  });

  it('numbers an element after Branch children like the runtime', () => {
    // SOURCE: <T><Branch branch="open" open="Open"><span>Closed</span></Branch><Var>{name}</Var></T>
    expectHash(
      `
        import { jsx, jsxs } from 'react/jsx-runtime';
        import { T, Branch, Var } from 'gt-react';
        jsxs(T, { children: [
          jsx(Branch, { branch: "open", open: "Open", children: jsx("span", { children: "Closed" }) }),
          jsx(Var, { children: name }),
        ] });
      `,
      [
        {
          t: 'Branch',
          i: 1,
          d: { b: { open: 'Open' }, t: 'b' },
          c: { t: 'span', i: 2, c: 'Closed' },
        },
        { i: 3, k: '_gt_value_3', v: 'v' },
      ]
    );
  });

  it('numbers branch props of a later element like the runtime', () => {
    // SOURCE: <T><Plural ...><Num>{2}</Num> bottles</Plural><Branch branch="open" open={<Var>{name}</Var>}>Closed</Branch></T>
    expectHash(
      `
        import { jsx, jsxs } from 'react/jsx-runtime';
        import { T, Plural, Branch, Num, Var } from 'gt-react';
        jsxs(T, { children: [
          jsxs(Plural, { n: 2, one: "one bottle", children: [jsx(Num, { children: 2 }), " bottles"] }),
          jsx(Branch, { branch: "open", open: jsx(Var, { children: name }), children: "Closed" }),
        ] });
      `,
      [
        pluralWithNumChild,
        {
          t: 'Branch',
          i: 3,
          d: { b: { open: { i: 4, k: '_gt_value_4', v: 'v' } }, t: 'b' },
          c: 'Closed',
        },
      ]
    );
  });
});
