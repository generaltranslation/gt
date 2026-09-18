import type { JsxChildren, JsxElement } from 'generaltranslation/types';
import { describe, expect, it } from 'vitest';

import type { LexicalNode, LexicalState } from '../lexical';
import {
  applyGtTree,
  buildGtTree,
  collectTranslations,
  isLexicalState,
} from '../lexical';
import { fixtureState, upperCaseTree } from './fixture';

const stripText = (state: LexicalState): LexicalState => {
  const clone = structuredClone(state);
  const visit = (node: LexicalNode): void => {
    if (node.type === 'text') node.text = '';
    for (const child of node.children ?? []) visit(child);
  };
  visit(clone.root);
  return clone;
};

const textValues = (state: LexicalState): string[] => {
  const values: string[] = [];
  const visit = (node: LexicalNode): void => {
    if (node.type === 'text') values.push(node.text ?? '');
    for (const child of node.children ?? []) visit(child);
  };
  visit(state.root);
  return values;
};

describe('isLexicalState', () => {
  it('accepts an editor state and rejects other values', () => {
    expect(isLexicalState(fixtureState())).toBe(true);
    expect(isLexicalState('plain string')).toBe(false);
    expect(isLexicalState(null)).toBe(false);
    expect(isLexicalState({ root: { type: 'paragraph' } })).toBe(false);
  });
});

describe('buildGtTree', () => {
  it('wraps every text node in an identified span with mapped parent tags', () => {
    const { textIds, tree } = buildGtTree(fixtureState());
    expect(textIds).toHaveLength(7);
    expect(new Set(textIds).size).toBe(7);
    const root = tree as JsxElement;
    expect(root.t).toBe('root');
    const children = root.c as JsxElement[];
    expect(children.map((child) => child.t)).toEqual(['h2', 'p', 'ul']);
    const paragraph = children[1].c as JsxElement[];
    expect(paragraph.map((child) => child.t)).toEqual([
      'span',
      'span',
      'span',
      'br',
      'span',
    ]);
    expect(paragraph[1].c).toBe('right before');
    expect(typeof paragraph[1].i).toBe('number');
  });
});

describe('applyGtTree', () => {
  it('changes only text node strings, byte for byte', () => {
    const source = fixtureState();
    const { tree } = buildGtTree(source);
    const translated = upperCaseTree(tree) as JsxChildren;
    const { missingIds, state } = applyGtTree(source, translated);
    expect(missingIds).toEqual([]);
    expect(stripText(state)).toEqual(stripText(source));
    expect(textValues(state)).toEqual(
      textValues(source).map((value) => value.toUpperCase())
    );
    const paragraph = state.root.children![1];
    expect(paragraph.children![1].format).toBe(1);
    expect(paragraph.children![3]).toEqual({ type: 'linebreak', version: 1 });
    expect(paragraph.textFormat).toBe(0);
  });

  it('keeps the source text and reports ids the response is missing', () => {
    const source = fixtureState();
    const { textIds, tree } = buildGtTree(source);
    const translated = upperCaseTree(tree) as JsxElement;
    const heading = (translated.c as JsxElement[])[0];
    delete (heading.c as JsxElement[])[0].i;
    const { missingIds, state } = applyGtTree(source, translated);
    expect(missingIds).toEqual([textIds[0]]);
    expect(textValues(state)[0]).toBe('Brewing at home');
    expect(textValues(state)[1]).toBe('GRIND THE BEANS ');
  });

  it('does not mutate the input state', () => {
    const source = fixtureState();
    const before = structuredClone(source);
    applyGtTree(source, upperCaseTree(buildGtTree(source).tree) as JsxChildren);
    expect(source).toEqual(before);
  });
});

describe('collectTranslations', () => {
  it('concatenates nested children under an identified element', () => {
    const found = collectTranslations([
      { c: ['Hola ', { c: 'mundo', i: 9, t: 'b' }], i: 3, t: 'span' },
    ]);
    expect(found.get(3)).toBe('Hola mundo');
    expect(found.get(9)).toBe('mundo');
  });
});
