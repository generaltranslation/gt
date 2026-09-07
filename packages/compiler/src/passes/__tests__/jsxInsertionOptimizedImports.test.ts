import { describe, expect, it } from 'vitest';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';
import { jsxInsertionPass } from '../jsxInsertionPass';
import { initializeState } from '../../state/utils/initializeState';
import { isGTImportSource } from '../../utils/constants/gt/helpers';

function transform(
  imported: string,
  body: string,
  source = '__barrel_optimize__?names=T,Var!=!gt-next'
) {
  const ast = parse(
    `import {jsx as h} from 'react/jsx-runtime'; import {${imported}} from ${JSON.stringify(source)}; ${body}`,
    { sourceType: 'module' }
  );
  const state = initializeState(
    { enableAutoJsxInjection: true, autoJsxImportSource: 'gt-next' },
    'optimized.jsx'
  );
  traverse(ast, jsxInsertionPass(state));
  const inserted: string[] = [];
  traverse(ast, {
    CallExpression(path) {
      const type = path.node.arguments[0];
      if (t.isIdentifier(type) && type.name.startsWith('GtInternal'))
        inserted.push(type.name);
    },
  });
  return { code: generate(ast).code, inserted };
}

describe('automatic JSX after Next barrel optimization', () => {
  it.each([
    'gt-next',
    'gt-next/server',
    'gt-react',
    'gt-react/client',
    'gt-react/browser',
  ])('preserves manual T from %s', (library) => {
    const result = transform(
      'T as Text',
      `h(Text, { children: h('p', {children: 'Manual text'}) });`,
      `__barrel_optimize__?names=T!=!${library}`
    );
    expect(result.inserted).toEqual([]);
  });

  it.each(['Var', 'Num', 'Currency', 'DateTime', 'RelativeTime'])(
    'preserves the %s subtree',
    (name) => {
      const result = transform(
        `${name} as Value`,
        `h(Value, {children: render(() => h('p', {children:'User variable text'}))});`
      );
      expect(result.inserted).toEqual([]);
    }
  );

  it.each(['Branch', 'Plural', 'Derive'])(
    'retains automatic ownership for %s',
    (name) => {
      const result = transform(
        `${name} as Choice`,
        `h(Choice, {children: 'Fallback'});`
      );
      expect(result.inserted).toEqual(['GtInternalTranslateJsx']);
    }
  );

  it('protects an already injected component after its import is optimized', () => {
    const result = transform(
      'GtInternalTranslateJsx as Translation',
      `h(Translation, {children: 'Already inserted'});`
    );
    expect(result.inserted).toEqual([]);
  });

  it('continues to translate an unrelated sibling beside manual T', () => {
    const result = transform(
      'T',
      `h(T, {children:'Manual'}); h('p', {children:'Automatic'});`
    );
    expect(result.inserted).toEqual(['GtInternalTranslateJsx']);
  });

  it('respects lexical shadowing of an optimized import', () => {
    const result = transform(
      'T',
      `function render(T) { return h(T, {children:'Local component'}); }`
    );
    expect(result.inserted).toEqual(['GtInternalTranslateJsx']);
  });

  it.each([
    'gt-next-extra',
    '__barrel_optimize__?names=T!=!gt-next-extra',
    '__barrel_optimize__?names=T!=!./gt-next',
    '__barrel_optimize__?names=T!=!gt-next/client',
    '__barrel_optimize__?names=T!=!gt-next?other',
    '__barrel_optimize__?names=T!other!=!gt-next',
    '__barrel_optimize__?names=T!=!other!=!gt-next',
    'other?names=T!=!gt-next',
  ])('does not classify lookalike source %s as a GT boundary', (source) => {
    const result = transform(
      'T',
      `h(T, {children:'Ordinary component'});`,
      source
    );
    expect(result.inserted).toEqual(['GtInternalTranslateJsx']);
  });

  it('keeps this host adaptation confined to automatic JSX insertion', () => {
    expect(isGTImportSource('__barrel_optimize__?names=T!=!gt-next')).toBe(
      false
    );
  });
});
