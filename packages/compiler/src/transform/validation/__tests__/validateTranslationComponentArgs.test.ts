import { describe, it, expect } from 'vitest';
import * as parser from '@babel/parser';
import traverse, { type NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { validateTranslationComponentArgs } from '../validateTranslationComponentArgs';
import { initializeState } from '../../../state/utils/initializeState';

/**
 * Parses `source` and returns the path of its first call expression plus a
 * fresh state.
 */
function setup(source: string) {
  const state = initializeState({ logLevel: 'silent' }, 'test.tsx');
  const ast = parser.parse(source, { sourceType: 'module' });
  let callPath!: NodePath<t.CallExpression>;
  traverse(ast, {
    CallExpression(path) {
      callPath = path;
      path.stop();
    },
  });
  return { callPath, state };
}

describe('validateTranslationComponentArgs requiresReview', () => {
  const REQUIRES_REVIEW_ERROR =
    'The <T> component must have a boolean literal (true or false) in its requiresReview field';

  it.each<[prop: string, expected: Record<string, unknown>]>([
    // A bare JSX attribute compiles to `requiresReview: true`
    ['requiresReview: true', { errors: [], requiresReview: true }],
    ['requiresReview: false', { errors: [], requiresReview: false }],
    // The $-prefixed alias is not read
    ['$requiresReview: true', { errors: [] }],
    ['requiresReview: "true"', { errors: [REQUIRES_REVIEW_ERROR] }],
    ['requiresReview: !flag', { errors: [REQUIRES_REVIEW_ERROR] }],
  ])('<T %s>', (prop, expected) => {
    const { callPath, state } = setup(
      `jsx(T, { children: "some text", ${prop} })`
    );
    const { errors, requiresReview } = validateTranslationComponentArgs(
      callPath,
      'T',
      state
    );
    expect({ errors, requiresReview }).toEqual(expected);
  });
});
