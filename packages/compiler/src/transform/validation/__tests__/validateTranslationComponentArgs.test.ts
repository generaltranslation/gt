import { describe, it, expect } from 'vitest';
import * as parser from '@babel/parser';
import traverse, { type NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { validateTranslationComponentArgs } from '../validateTranslationComponentArgs';
import { initializeState } from '../../../state/utils/initializeState';
import { GT_OTHER_FUNCTIONS } from '../../../utils/constants/gt/constants';

/**
 * Parses `source` and returns the path of its first call expression plus a
 * fresh state with derive() registered as a GT function.
 */
function setup(source: string) {
  const state = initializeState({ logLevel: 'silent' }, 'test.tsx');
  state.scopeTracker.trackTranslationVariable(
    GT_OTHER_FUNCTIONS.derive,
    GT_OTHER_FUNCTIONS.derive
  );
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

describe('validateTranslationComponentArgs context', () => {
  const validate = (context: string) => {
    const { callPath, state } = setup(
      `async () => jsx(T, { children: "some text", context: ${context} })`
    );
    const {
      errors,
      context: value,
      hasDeriveContext,
    } = validateTranslationComponentArgs(callPath, 'T', state);
    return { errors, value, hasDeriveContext };
  };

  it.each(['"greeting"', '`greeting`'])('reads the literal %s', (context) => {
    expect(validate(context)).toEqual({
      errors: [],
      value: 'greeting',
      hasDeriveContext: false,
    });
  });

  it.each([
    'derive(getTone())',
    'derive(await getTone())',
    'derive(formal ? "formal" : "casual")',
    'derive(tone)',
  ])('accepts %s as a derive context', (context) => {
    expect(validate(context)).toEqual({ errors: [], hasDeriveContext: true });
  });

  it.each([
    '"tone: " + derive(getTone())',
    '`tone: ${derive(getTone())}`',
    'formal ? derive(getTone()) : "casual"',
    'derive()',
    'derive(getTone(), "casual")',
    'derive(...tones)',
    'getTone()',
    'tone',
  ])('rejects %s', (context) => {
    expect(validate(context).errors).toEqual([
      'The <T> component must have a string literal or one derive() call in its context field',
    ]);
  });
});
