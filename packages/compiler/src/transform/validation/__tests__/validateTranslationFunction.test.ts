import { describe, it, expect } from 'vitest';
import * as parser from '@babel/parser';
import traverse, { type NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import {
  validateTranslationFunction,
  validateUseMessagesCallback,
} from '../validateTranslationFunction';
import { validateTranslationComponentArgs } from '../validateTranslationComponentArgs';
import { initializeState } from '../../../state/utils/initializeState';

const NOT_STATIC = 'Expression is not a static string';
const VARIABLE = 'Variables are not allowed';
const NOT_ALLOWED_CALL = 'Expression does not use an allowed call expression';
const FIRST_ARG =
  'registration function must use a string literal or derive() call as the first argument. Variable content is not allowed.';
const INVALID_ESCAPE = 'Template literal contains an invalid escape sequence';

/**
 * Parses `source` and returns the path of its first call expression plus a
 * fresh state with derive() registered as a GT function.
 * `invalidEscapes` lets `\xg`-style template escapes through the parser
 * (they are only a syntax error in untagged templates).
 */
function setup(
  source: string,
  options: Record<string, unknown> = {},
  { invalidEscapes = false } = {}
) {
  const state = initializeState({ logLevel: 'silent', ...options }, 'test.tsx');
  state.scopeTracker.trackTranslationVariable('derive', 'derive', 0);
  const ast = parser.parse(source, {
    sourceType: 'module',
    errorRecovery: invalidEscapes,
  });
  let callPath!: NodePath<t.CallExpression>;
  traverse(ast, {
    CallExpression(path) {
      callPath = path;
      path.stop();
    },
  });
  return { callPath, state };
}

/** Validates the registration call in `source`, e.g. gt("Hello", { ... }) */
function validate(
  source: string,
  options?: Record<string, unknown>,
  parseOptions?: { invalidEscapes: boolean }
) {
  const { callPath, state } = setup(source, options, parseOptions);
  return validateTranslationFunction(callPath, state);
}

describe('validateTranslationFunction', () => {
  describe('first argument', () => {
    // Anything statically deterministic resolves to the full string
    it.each([
      ['"Hello world"', 'Hello world'],
      ['`Hello world`', 'Hello world'],
      ['""', ''],
      ['`${""}`', ''],
      ['`Hello \\`World\\``', 'Hello `World`'],
      // Concatenation
      ['"Hello" + " World"', 'Hello World'],
      ['"A" + ("B" + "C")', 'ABC'],
      ['"" + "Hello" + ""', 'Hello'],
      ['"Hello\\n" + "World"', 'Hello\nWorld'],
      ['"Hello" + ` World`', 'Hello World'],
      // Template literals with static expressions
      ['`${"Hello"} ${"World"}`', 'Hello World'],
      ['`Hello ${`World`}`', 'Hello World'],
      ['`Hello ${"Wo" + "rld"}`', 'Hello World'],
      ['`A ${`B ${`C ${"D"}`}`}`', 'A B C D'],
      // Mixed
      ['"A" + `B ${"C" + "D"}` + "E"', 'AB CDE'],
      [
        '"Hello" + `World` + ` Here ${"is" + `a ${"nested"}`} string`',
        'HelloWorld Here isa nested string',
      ],
      // Non-string literals are coerced
      ['"Count: " + 42', 'Count: 42'],
      ['`Price: ${9.99}`', 'Price: 9.99'],
      ['`${0} items`', '0 items'],
      ['`Value: ${true}`', 'Value: true'],
      ['"Active: " + false', 'Active: false'],
      ['`Value: ${null}`', 'Value: null'],
    ])('resolves gt(%s)', (expression, content) => {
      expect(validate(`gt(${expression})`)).toEqual({ errors: [], content });
    });

    it.each([
      'name',
      '"Hello " + name',
      '"Hello " + obj.name',
      '"Hello " + (flag ? "A" : "B")',
      '"Hello " - "World"',
      '"Hello " + getName()',
      '`Hello ${getName()}`',
      'someOtherFunction("arg")',
    ])('rejects dynamic gt(%s)', (expression) => {
      const result = validate(`gt(${expression})`);
      expect(result.errors).toContain(NOT_STATIC);
      expect(result.errors.at(-1)).toBe(FIRST_ARG);
      expect(result.content).toBeUndefined();
    });

    it('reports every problem with a dynamic argument', () => {
      expect(validate('gt(myString)').errors).toEqual([
        VARIABLE,
        NOT_STATIC,
        FIRST_ARG,
      ]);
      expect(validate('gt(`Hello ${name}`)').errors).toEqual([
        VARIABLE,
        NOT_ALLOWED_CALL,
        NOT_STATIC,
        FIRST_ARG,
      ]);
    });

    it.each([
      ['gt()', 'registration function must have at least 1 argument'],
      ['gt(...args)', FIRST_ARG],
    ])('rejects %s', (source, error) => {
      expect(validate(source)).toEqual({ errors: [error] });
    });
  });

  describe('derive() in the first argument', () => {
    it.each([
      'derive(getName())',
      'derive(await getName())',
      '"Hello " + derive(getName())',
      '"Hello " + "World " + derive(getName())',
      '`Hello ${derive(getName())}!`',
      '`Hello ${derive(await getName())}!`',
      '`${"A" + "B"} ${derive(fn())}`',
    ])('accepts gt(%s)', (expression) => {
      expect(validate(`gt(${expression})`)).toEqual({ errors: [] });
    });

    it.each([
      ['derive()', 'derive() must have one argument'],
      ['derive(getName(), "extra")', 'derive() must have one argument'],
      [
        'derive("not a call")',
        'derive() must have a call expression as the argument',
      ],
      [
        'derive(await "not a call")',
        'derive() must have a call expression as the argument',
      ],
    ])('rejects gt(%s)', (expression, error) => {
      expect(validate(`gt(${expression})`).errors).toEqual([
        error,
        NOT_STATIC,
        FIRST_ARG,
      ]);
    });
  });

  describe('options argument', () => {
    it.each<[options: string, expected: Record<string, unknown>]>([
      ['{}', {}],
      ['{ $context: "greeting" }', { context: 'greeting' }],
      ['{ "$context": "greeting" }', { context: 'greeting' }],
      ['{ $context: `greeting` }', { context: 'greeting' }],
      ['{ $id: "hello-id" }', { id: 'hello-id' }],
      ['{ $_hash: "abc123" }', { hash: 'abc123' }],
      ['{ $maxChars: 20 }', { maxChars: 20 }],
      ['{ $format: "STRING" }', { format: 'STRING' }],
      ['{ $requiresReview: true }', { requiresReview: true }],
      ['{ $requiresReview: false }', { requiresReview: false }],
      [
        '{ $context: "greeting", $id: "hello-id", $_hash: "abc123", $maxChars: 50, $format: "I18NEXT" }',
        {
          context: 'greeting',
          id: 'hello-id',
          hash: 'abc123',
          maxChars: 50,
          format: 'I18NEXT',
        },
      ],
      // Spread and computed keys are ignored
      ['{ $context: "greeting", ...otherProps }', { context: 'greeting' }],
      [
        '{ $context: "greeting", ["$" + "id"]: "computed-id" }',
        { context: 'greeting' },
      ],
      // derive() is allowed in $context
      ['{ $context: derive(getFormality()) }', { hasDeriveContext: true }],
      [
        '{ $context: "prefix-" + derive(getFormality()) }',
        { hasDeriveContext: true },
      ],
      [
        '{ $context: `prefix-${derive(getFormality())}` }',
        { hasDeriveContext: true },
      ],
    ])('extracts %s', (options, expected) => {
      expect(validate(`gt("Hello", ${options})`)).toEqual({
        errors: [],
        content: 'Hello',
        ...expected,
      });
    });

    it('extracts options alongside a complex first argument', () => {
      expect(
        validate('gt("A" + `B ${"C"}`, { $id: "abc", $maxChars: 50 })')
      ).toEqual({ errors: [], content: 'AB C', id: 'abc', maxChars: 50 });
    });

    it.each([
      ['{ $id: idVar }', ['Expression is not a string literal']],
      ['{ $format: someVar }', ['Expression is not a string literal']],
      ['{ $requiresReview: "false" }', ['Expression is not a boolean literal']],
      ['{ $requiresReview: someVar }', ['Expression is not a boolean literal']],
      ['{ $context: contextVar }', [NOT_STATIC, VARIABLE]],
      [
        '{ $context: derive("not-a-function") }',
        [NOT_STATIC, 'derive() must have a call expression as the argument'],
      ],
    ])('rejects %s', (options, errors) => {
      expect(validate(`gt("Hello", ${options})`)).toEqual({
        errors,
        content: 'Hello',
      });
    });

    it('reports invalid template escapes in $context', () => {
      expect(
        validate(
          'gt("Hello", { $context: `\\xg` })',
          {},
          { invalidEscapes: true }
        )
      ).toEqual({ errors: [INVALID_ESCAPE], content: 'Hello' });
    });
  });

  describe('autoderive', () => {
    it.each([
      'gt(myVar)',
      'gt(`Hello, ${name}`)',
      'gt("Hello, " + getName())',
      'gt(`Hello, ${derive(getName())} and ${name}`)',
    ])('accepts dynamic %s and flags it for derivation', (source) => {
      expect(validate(source, { autoderive: true })).toEqual({
        errors: [],
        hasDeriveContext: true,
      });
    });

    it.each([
      [true, true],
      [{ jsx: false, strings: true }, true],
      [{ jsx: true, strings: false }, false],
      [false, false],
    ])(
      'autoderive: %j -> dynamic strings allowed: %s',
      (autoderive, allowed) => {
        for (const source of ['gt(`Hello, ${name}`)', 'gt("Hello, " + name)']) {
          expect(validate(source, { autoderive }).errors.length === 0).toBe(
            allowed
          );
        }
      }
    );

    it('does not apply to $context', () => {
      expect(
        validate('gt("Hello", { $context: contextVar })', { autoderive: true })
      ).toEqual({ errors: [NOT_STATIC, VARIABLE], content: 'Hello' });
    });

    it('still reports invalid template escapes', () => {
      expect(
        validate('gt(`\\xg`)', { autoderive: true }, { invalidEscapes: true })
      ).toEqual({ errors: [INVALID_ESCAPE] });
    });
  });
});

describe('validateUseMessagesCallback', () => {
  it('accepts any arguments, including dynamic ones', () => {
    const { callPath } = setup('callback(someVar, `Hello, ${name}`, 123)');
    expect(validateUseMessagesCallback(callPath.node)).toEqual({ errors: [] });
  });
});

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
