import { describe, it, expect, beforeEach } from 'vitest';
import * as t from '@babel/types';
import { validateUseGTCallback } from '../validateTranslationFunctionCallback';
import { TransformState } from '../../../state/types';
import { StringCollector } from '../../../state/StringCollector';
import { Logger } from '../../../state/Logger';
import { ErrorTracker } from '../../../state/ErrorTracker';
import { ScopeTracker } from '../../../state/ScopeTracker';
import { PluginSettings } from '../../../config';
import { GT_OTHER_FUNCTIONS } from '../../../utils/constants/gt/constants';

/**
 * Golden standard tests for robust string extraction.
 *
 * The compiler should be able to extract the fully-resolved string content
 * from any expression that is statically deterministic at compile time.
 * This includes:
 * - String concatenation: "Hello" + " World"
 * - Template literals with static expressions: `Hello ${"World"}`
 * - Nested template literals: `A ${`B ${`C`}`}`
 * - Mixed: "Hello" + `World ${" Here"}`
 * - Numeric/boolean literals coerced in concat
 *
 * These tests validate gt(), msg(), and t() extraction via validateUseGTCallback,
 * which is the shared validation function for all three.
 */

function createState(overrides?: Partial<PluginSettings>): TransformState {
  const stringCollector = new StringCollector();
  const logger = new Logger('silent');
  const errorTracker = new ErrorTracker();
  const scopeTracker = new ScopeTracker();
  const settings: PluginSettings = {
    logLevel: 'silent',
    compileTimeHash: false,
    disableBuildChecks: false,
    enableMacroTransform: true,
    stringTranslationMacro: GT_OTHER_FUNCTIONS.t,
    enableTaggedTemplate: true,
    enableTemplateLiteralArg: true,
    enableConcatenationArg: true,
    enableMacroImportInjection: true,
    enableAutoJsxInjection: false,
    autoderive: { jsx: false, strings: false },
    _debugHashManifest: false,
    devHotReload: { strings: false, jsx: false },
    ...overrides,
  };

  scopeTracker.trackTranslationVariable(
    GT_OTHER_FUNCTIONS.derive,
    GT_OTHER_FUNCTIONS.derive,
    0
  );

  return {
    settings,
    stringCollector,
    scopeTracker,
    logger,
    errorTracker,
    statistics: {
      jsxElementCount: 0,
      dynamicContentViolations: 0,
      macroExpansionsCount: 0,
      jsxInsertionsCount: 0,
      runtimeTranslateCount: 0,
    },
  };
}

function makeCall(firstArg: t.Expression): t.CallExpression {
  return t.callExpression(t.identifier('gt'), [firstArg]);
}

function makeCallWithOptions(
  firstArg: t.Expression,
  options: t.ObjectExpression
): t.CallExpression {
  return t.callExpression(t.identifier('gt'), [firstArg, options]);
}

// Helper: "a" + "b"
function concat(left: t.Expression, right: t.Expression): t.BinaryExpression {
  return t.binaryExpression('+', left, right);
}

// Helper: `...${expr}...`
function template(
  strings: string[],
  ...exprs: t.Expression[]
): t.TemplateLiteral {
  const quasis = strings.map((s, i) =>
    t.templateElement({ raw: s, cooked: s }, i === strings.length - 1)
  );
  return t.templateLiteral(quasis, exprs);
}

describe('Robust string extraction — golden standard', () => {
  let state: TransformState;

  beforeEach(() => {
    state = createState();
  });

  // ─────────────────────────────────────────────────
  // 1. STRING CONCATENATION
  // ─────────────────────────────────────────────────

  describe('string concatenation', () => {
    it('should extract from two string literals: "Hello" + " World"', () => {
      const expr = concat(t.stringLiteral('Hello'), t.stringLiteral(' World'));
      const result = validateUseGTCallback(makeCall(expr), state);

      expect(result.errors).toHaveLength(0);
      expect(result.content).toBe('Hello World');
    });

    it('should extract from three chained string literals: "A" + "B" + "C"', () => {
      // "A" + "B" + "C" parses as ("A" + "B") + "C"
      const expr = concat(
        concat(t.stringLiteral('A'), t.stringLiteral('B')),
        t.stringLiteral('C')
      );
      const result = validateUseGTCallback(makeCall(expr), state);

      expect(result.errors).toHaveLength(0);
      expect(result.content).toBe('ABC');
    });

    it('should extract from right-associative concatenation: "A" + ("B" + "C")', () => {
      const expr = concat(
        t.stringLiteral('A'),
        concat(t.stringLiteral('B'), t.stringLiteral('C'))
      );
      const result = validateUseGTCallback(makeCall(expr), state);

      expect(result.errors).toHaveLength(0);
      expect(result.content).toBe('ABC');
    });

    it('should extract from deeply chained concatenation: "A" + "B" + "C" + "D" + "E"', () => {
      // Left-associative: (((("A" + "B") + "C") + "D") + "E")
      let expr: t.Expression = t.stringLiteral('A');
      for (const s of ['B', 'C', 'D', 'E']) {
        expr = concat(expr, t.stringLiteral(s));
      }
      const result = validateUseGTCallback(makeCall(expr), state);

      expect(result.errors).toHaveLength(0);
      expect(result.content).toBe('ABCDE');
    });

    it('should extract from concatenation with empty strings: "" + "Hello" + ""', () => {
      const expr = concat(
        concat(t.stringLiteral(''), t.stringLiteral('Hello')),
        t.stringLiteral('')
      );
      const result = validateUseGTCallback(makeCall(expr), state);

      expect(result.errors).toHaveLength(0);
      expect(result.content).toBe('Hello');
    });

    it('should extract from string + template literal: "Hello" + ` World`', () => {
      const expr = concat(t.stringLiteral('Hello'), template([' World']));
      const result = validateUseGTCallback(makeCall(expr), state);

      expect(result.errors).toHaveLength(0);
      expect(result.content).toBe('Hello World');
    });

    it('should extract from template literal + string: `Hello` + " World"', () => {
      const expr = concat(template(['Hello']), t.stringLiteral(' World'));
      const result = validateUseGTCallback(makeCall(expr), state);

      expect(result.errors).toHaveLength(0);
      expect(result.content).toBe('Hello World');
    });

    it('should extract from template + template: `Hello` + ` World`', () => {
      const expr = concat(template(['Hello']), template([' World']));
      const result = validateUseGTCallback(makeCall(expr), state);

      expect(result.errors).toHaveLength(0);
      expect(result.content).toBe('Hello World');
    });
  });

  // ─────────────────────────────────────────────────
  // 2. TEMPLATE LITERALS WITH STATIC EXPRESSIONS
  // ─────────────────────────────────────────────────

  describe('template literals with static expressions', () => {
    it('should extract from template with string expression: `Hello ${"World"}`', () => {
      const expr = template(['Hello ', ''], t.stringLiteral('World'));
      const result = validateUseGTCallback(makeCall(expr), state);

      expect(result.errors).toHaveLength(0);
      expect(result.content).toBe('Hello World');
    });

    it('should extract from template with multiple string expressions: `${"Hello"} ${"World"}`', () => {
      const expr = template(
        ['', ' ', ''],
        t.stringLiteral('Hello'),
        t.stringLiteral('World')
      );
      const result = validateUseGTCallback(makeCall(expr), state);

      expect(result.errors).toHaveLength(0);
      expect(result.content).toBe('Hello World');
    });

    it('should extract from template with template expression: `Hello ${`World`}`', () => {
      const expr = template(['Hello ', ''], template(['World']));
      const result = validateUseGTCallback(makeCall(expr), state);

      expect(result.errors).toHaveLength(0);
      expect(result.content).toBe('Hello World');
    });

    it('should extract from template with concatenation expression: `Hello ${"Wo" + "rld"}`', () => {
      const expr = template(
        ['Hello ', ''],
        concat(t.stringLiteral('Wo'), t.stringLiteral('rld'))
      );
      const result = validateUseGTCallback(makeCall(expr), state);

      expect(result.errors).toHaveLength(0);
      expect(result.content).toBe('Hello World');
    });

    it('should extract from template expression at start: `${"Hello"} World`', () => {
      const expr = template(['', ' World'], t.stringLiteral('Hello'));
      const result = validateUseGTCallback(makeCall(expr), state);

      expect(result.errors).toHaveLength(0);
      expect(result.content).toBe('Hello World');
    });

    it('should extract from template expression at end: `Hello ${" World"}`', () => {
      const expr = template(['Hello', ''], t.stringLiteral(' World'));
      const result = validateUseGTCallback(makeCall(expr), state);

      expect(result.errors).toHaveLength(0);
      expect(result.content).toBe('Hello World');
    });

    it('should extract from template with only an expression: `${"Hello World"}`', () => {
      const expr = template(['', ''], t.stringLiteral('Hello World'));
      const result = validateUseGTCallback(makeCall(expr), state);

      expect(result.errors).toHaveLength(0);
      expect(result.content).toBe('Hello World');
    });
  });

  // ─────────────────────────────────────────────────
  // 3. NESTED TEMPLATE LITERALS
  // ─────────────────────────────────────────────────

  describe('nested template literals', () => {
    it('should extract from two levels of nesting: `A ${`B ${"C"}`}`', () => {
      const inner = template(['B ', ''], t.stringLiteral('C'));
      const outer = template(['A ', ''], inner);
      const result = validateUseGTCallback(makeCall(outer), state);

      expect(result.errors).toHaveLength(0);
      expect(result.content).toBe('A B C');
    });

    it('should extract from three levels of nesting: `A ${`B ${`C ${"D"}`}`}`', () => {
      const innermost = template(['C ', ''], t.stringLiteral('D'));
      const middle = template(['B ', ''], innermost);
      const outer = template(['A ', ''], middle);
      const result = validateUseGTCallback(makeCall(outer), state);

      expect(result.errors).toHaveLength(0);
      expect(result.content).toBe('A B C D');
    });

    it('should extract from nested template with multiple expressions: `${`${"A"}${`B`}`}`', () => {
      const inner = template(
        ['', '', ''],
        t.stringLiteral('A'),
        template(['B'])
      );
      const outer = template(['', ''], inner);
      const result = validateUseGTCallback(makeCall(outer), state);

      expect(result.errors).toHaveLength(0);
      expect(result.content).toBe('AB');
    });
  });

  // ─────────────────────────────────────────────────
  // 4. MIXED CONCATENATION + TEMPLATE LITERALS
  // ─────────────────────────────────────────────────

  describe('mixed concatenation and template literals', () => {
    it('should extract from: "Hello" + ` World ${"Here"}`', () => {
      const expr = concat(
        t.stringLiteral('Hello'),
        template([' World ', ''], t.stringLiteral('Here'))
      );
      const result = validateUseGTCallback(makeCall(expr), state);

      expect(result.errors).toHaveLength(0);
      expect(result.content).toBe('Hello World Here');
    });

    it('should extract from: `Hello ${"World"}` + " End"', () => {
      const expr = concat(
        template(['Hello ', ''], t.stringLiteral('World')),
        t.stringLiteral(' End')
      );
      const result = validateUseGTCallback(makeCall(expr), state);

      expect(result.errors).toHaveLength(0);
      expect(result.content).toBe('Hello World End');
    });

    it('should extract the user example: "Hello" + `World` + ` Here ${"is" + `a ${"nested"}`} string`', () => {
      // `a ${"nested"}` → "a nested"
      const innerTemplate = template(['a ', ''], t.stringLiteral('nested'));
      // "is" + `a ${"nested"}` → "isa nested"
      const concatInner = concat(t.stringLiteral('is'), innerTemplate);
      // ` Here ${"is" + `a ${"nested"}`} string` → " Here isa nested string"
      const outerTemplate = template([' Here ', ' string'], concatInner);
      // "Hello" + `World` + ` Here ...`
      const expr = concat(
        concat(t.stringLiteral('Hello'), template(['World'])),
        outerTemplate
      );
      const result = validateUseGTCallback(makeCall(expr), state);

      expect(result.errors).toHaveLength(0);
      expect(result.content).toBe('HelloWorld Here isa nested string');
    });

    it('should extract from concat inside template inside concat: "A" + `B ${"C" + "D"}` + "E"', () => {
      const innerConcat = concat(t.stringLiteral('C'), t.stringLiteral('D'));
      const middleTemplate = template(['B ', ''], innerConcat);
      const expr = concat(
        concat(t.stringLiteral('A'), middleTemplate),
        t.stringLiteral('E')
      );
      const result = validateUseGTCallback(makeCall(expr), state);

      expect(result.errors).toHaveLength(0);
      expect(result.content).toBe('AB CDE');
    });

    it('should extract from template inside concat inside template: `A ${`B` + `C`} D`', () => {
      const innerConcat = concat(template(['B']), template(['C']));
      const expr = template(['A ', ' D'], innerConcat);
      const result = validateUseGTCallback(makeCall(expr), state);

      expect(result.errors).toHaveLength(0);
      expect(result.content).toBe('A BC D');
    });
  });

  // ─────────────────────────────────────────────────
  // 5. NUMERIC LITERALS IN STATIC EXPRESSIONS
  // ─────────────────────────────────────────────────

  describe('numeric literals in static expressions', () => {
    it('should extract from template with numeric expression: `Count: ${5}`', () => {
      const expr = template(['Count: ', ''], t.numericLiteral(5));
      const result = validateUseGTCallback(makeCall(expr), state);

      expect(result.errors).toHaveLength(0);
      expect(result.content).toBe('Count: 5');
    });

    it('should extract from concatenation with numeric: "Count: " + 42', () => {
      const expr = concat(t.stringLiteral('Count: '), t.numericLiteral(42));
      const result = validateUseGTCallback(makeCall(expr), state);

      expect(result.errors).toHaveLength(0);
      expect(result.content).toBe('Count: 42');
    });

    it('should extract from template with float: `Price: ${9.99}`', () => {
      const expr = template(['Price: ', ''], t.numericLiteral(9.99));
      const result = validateUseGTCallback(makeCall(expr), state);

      expect(result.errors).toHaveLength(0);
      expect(result.content).toBe('Price: 9.99');
    });

    it('should extract from template with zero: `${0} items`', () => {
      const expr = template(['', ' items'], t.numericLiteral(0));
      const result = validateUseGTCallback(makeCall(expr), state);

      expect(result.errors).toHaveLength(0);
      expect(result.content).toBe('0 items');
    });
  });

  // ─────────────────────────────────────────────────
  // 6. BOOLEAN LITERALS IN STATIC EXPRESSIONS
  // ─────────────────────────────────────────────────

  describe('boolean literals in static expressions', () => {
    it('should extract from template with boolean: `Value: ${true}`', () => {
      const expr = template(['Value: ', ''], t.booleanLiteral(true));
      const result = validateUseGTCallback(makeCall(expr), state);

      expect(result.errors).toHaveLength(0);
      expect(result.content).toBe('Value: true');
    });

    it('should extract from concatenation with boolean: "Active: " + false', () => {
      const expr = concat(t.stringLiteral('Active: '), t.booleanLiteral(false));
      const result = validateUseGTCallback(makeCall(expr), state);

      expect(result.errors).toHaveLength(0);
      expect(result.content).toBe('Active: false');
    });
  });

  // ─────────────────────────────────────────────────
  // 7. NULL LITERAL IN STATIC EXPRESSIONS
  // ─────────────────────────────────────────────────

  describe('null literal in static expressions', () => {
    it('should extract from template with null: `Value: ${null}`', () => {
      const expr = template(['Value: ', ''], t.nullLiteral());
      const result = validateUseGTCallback(makeCall(expr), state);

      expect(result.errors).toHaveLength(0);
      expect(result.content).toBe('Value: null');
    });

    it('should extract from concatenation with null: "Value: " + null', () => {
      const expr = concat(t.stringLiteral('Value: '), t.nullLiteral());
      const result = validateUseGTCallback(makeCall(expr), state);

      expect(result.errors).toHaveLength(0);
      expect(result.content).toBe('Value: null');
    });
  });

  // ─────────────────────────────────────────────────
  // 8. EDGE CASES
  // ─────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should extract from single empty string literal: ""', () => {
      const result = validateUseGTCallback(
        makeCall(t.stringLiteral('')),
        state
      );

      expect(result.errors).toHaveLength(0);
      expect(result.content).toBe('');
    });

    it('should extract from concatenation of empty strings: "" + ""', () => {
      const expr = concat(t.stringLiteral(''), t.stringLiteral(''));
      const result = validateUseGTCallback(makeCall(expr), state);

      expect(result.errors).toHaveLength(0);
      expect(result.content).toBe('');
    });

    it('should extract from empty template literal: ``', () => {
      const expr = template(['']);
      const result = validateUseGTCallback(makeCall(expr), state);

      expect(result.errors).toHaveLength(0);
      expect(result.content).toBe('');
    });

    it('should extract from template with empty expression: `${""}`', () => {
      const expr = template(['', ''], t.stringLiteral(''));
      const result = validateUseGTCallback(makeCall(expr), state);

      expect(result.errors).toHaveLength(0);
      expect(result.content).toBe('');
    });

    it('should handle strings with special characters in concat: "Hello\\n" + "World"', () => {
      const expr = concat(t.stringLiteral('Hello\n'), t.stringLiteral('World'));
      const result = validateUseGTCallback(makeCall(expr), state);

      expect(result.errors).toHaveLength(0);
      expect(result.content).toBe('Hello\nWorld');
    });

    it('should handle strings with unicode in concat: "Hello " + "🌍"', () => {
      const expr = concat(t.stringLiteral('Hello '), t.stringLiteral('🌍'));
      const result = validateUseGTCallback(makeCall(expr), state);

      expect(result.errors).toHaveLength(0);
      expect(result.content).toBe('Hello 🌍');
    });

    it('should handle template with escaped backticks in quasis', () => {
      // `Hello \`World\`` — raw must use \\` for backtick escaping
      const quasis = [
        t.templateElement(
          { raw: 'Hello \\`World\\`', cooked: 'Hello `World`' },
          true
        ),
      ];
      const expr = t.templateLiteral(quasis, []);
      const result = validateUseGTCallback(makeCall(expr), state);

      expect(result.errors).toHaveLength(0);
      expect(result.content).toBe('Hello `World`');
    });

    it('should handle very long concatenation chains (20 segments)', () => {
      let expr: t.Expression = t.stringLiteral('0');
      for (let i = 1; i < 20; i++) {
        expr = concat(expr, t.stringLiteral(String(i)));
      }
      const result = validateUseGTCallback(makeCall(expr), state);

      expect(result.errors).toHaveLength(0);
      expect(result.content).toBe(
        Array.from({ length: 20 }, (_, i) => String(i)).join('')
      );
    });

    it('should handle deeply nested templates (5 levels)', () => {
      // `A ${`B ${`C ${`D ${"E"}`}`}`}`
      let expr: t.Expression = t.stringLiteral('E');
      for (const prefix of ['D ', 'C ', 'B ', 'A ']) {
        expr = template([prefix, ''], expr);
      }
      const result = validateUseGTCallback(makeCall(expr), state);

      expect(result.errors).toHaveLength(0);
      expect(result.content).toBe('A B C D E');
    });
  });

  // ─────────────────────────────────────────────────
  // 9. MUST STILL REJECT DYNAMIC CONTENT
  // ─────────────────────────────────────────────────

  describe('rejection of dynamic content', () => {
    it('should reject identifier variable: gt(name)', () => {
      const result = validateUseGTCallback(
        makeCall(t.identifier('name')),
        state
      );
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.content).toBeUndefined();
    });

    it('should reject template with identifier expression: gt(`Hello ${name}`)', () => {
      const expr = template(['Hello ', ''], t.identifier('name'));
      const result = validateUseGTCallback(makeCall(expr), state);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.content).toBeUndefined();
    });

    it('should reject concatenation with identifier: gt("Hello " + name)', () => {
      const expr = concat(t.stringLiteral('Hello '), t.identifier('name'));
      const result = validateUseGTCallback(makeCall(expr), state);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.content).toBeUndefined();
    });

    it('should reject if any part of concatenation is dynamic: "A" + name + "B"', () => {
      const expr = concat(
        concat(t.stringLiteral('A'), t.identifier('name')),
        t.stringLiteral('B')
      );
      const result = validateUseGTCallback(makeCall(expr), state);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.content).toBeUndefined();
    });

    it('should reject function call in concatenation: "Hello " + getName()', () => {
      const expr = concat(
        t.stringLiteral('Hello '),
        t.callExpression(t.identifier('getName'), [])
      );
      const result = validateUseGTCallback(makeCall(expr), state);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.content).toBeUndefined();
    });

    it('should reject function call in template: `Hello ${getName()}`', () => {
      const expr = template(
        ['Hello ', ''],
        t.callExpression(t.identifier('getName'), [])
      );
      const result = validateUseGTCallback(makeCall(expr), state);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.content).toBeUndefined();
    });

    it('should reject mixed static + dynamic in deeply nested template', () => {
      // `A ${`B ${name}`}` — name is dynamic even though the rest is static
      const inner = template(['B ', ''], t.identifier('name'));
      const outer = template(['A ', ''], inner);
      const result = validateUseGTCallback(makeCall(outer), state);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.content).toBeUndefined();
    });

    it('should reject member expression in concatenation: "Hello " + obj.name', () => {
      const expr = concat(
        t.stringLiteral('Hello '),
        t.memberExpression(t.identifier('obj'), t.identifier('name'))
      );
      const result = validateUseGTCallback(makeCall(expr), state);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.content).toBeUndefined();
    });

    it('should reject conditional expression: "Hello " + (flag ? "A" : "B")', () => {
      const expr = concat(
        t.stringLiteral('Hello '),
        t.conditionalExpression(
          t.identifier('flag'),
          t.stringLiteral('A'),
          t.stringLiteral('B')
        )
      );
      const result = validateUseGTCallback(makeCall(expr), state);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.content).toBeUndefined();
    });

    it('should reject non-+ binary operator: "Hello " - "World"', () => {
      const expr = t.binaryExpression(
        '-',
        t.stringLiteral('Hello '),
        t.stringLiteral('World')
      );
      const result = validateUseGTCallback(makeCall(expr), state);

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.content).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────
  // 10. DERIVE STILL WORKS WITH COMPLEX EXPRESSIONS
  // ─────────────────────────────────────────────────

  describe('derive with complex static expressions', () => {
    it('should accept derive alongside static concatenation', () => {
      // gt("Hello " + "World " + derive(getName()))
      const deriveCall = t.callExpression(
        t.identifier(GT_OTHER_FUNCTIONS.derive),
        [t.callExpression(t.identifier('getName'), [])]
      );
      const expr = concat(
        concat(t.stringLiteral('Hello '), t.stringLiteral('World ')),
        deriveCall
      );
      const result = validateUseGTCallback(makeCall(expr), state);

      expect(result.errors).toHaveLength(0);
    });

    it('should accept derive inside template with static concat: `${"A" + "B"} ${derive(fn())}`', () => {
      const staticConcat = concat(t.stringLiteral('A'), t.stringLiteral('B'));
      const deriveCall = t.callExpression(
        t.identifier(GT_OTHER_FUNCTIONS.derive),
        [t.callExpression(t.identifier('fn'), [])]
      );
      const expr = template(['', ' ', ''], staticConcat, deriveCall);
      const result = validateUseGTCallback(makeCall(expr), state);

      expect(result.errors).toHaveLength(0);
    });
  });

  // ─────────────────────────────────────────────────
  // 11. SECOND ARGUMENT (OPTIONS) UNAFFECTED
  // ─────────────────────────────────────────────────

  describe('options with complex first argument', () => {
    it('should extract content and options from concat: gt("Hello" + " World", { $id: "hw" })', () => {
      const expr = concat(t.stringLiteral('Hello'), t.stringLiteral(' World'));
      const options = t.objectExpression([
        t.objectProperty(t.identifier('$id'), t.stringLiteral('hw')),
      ]);
      const result = validateUseGTCallback(
        makeCallWithOptions(expr, options),
        state
      );

      expect(result.errors).toHaveLength(0);
      expect(result.content).toBe('Hello World');
      expect(result.id).toBe('hw');
    });

    it('should extract content and context from nested template', () => {
      // gt(`Hello ${"World"}`, { $context: "greeting" })
      const expr = template(['Hello ', ''], t.stringLiteral('World'));
      const options = t.objectExpression([
        t.objectProperty(t.identifier('$context'), t.stringLiteral('greeting')),
      ]);
      const result = validateUseGTCallback(
        makeCallWithOptions(expr, options),
        state
      );

      expect(result.errors).toHaveLength(0);
      expect(result.content).toBe('Hello World');
      expect(result.context).toBe('greeting');
    });

    it('should extract content and maxChars from concat', () => {
      // gt("Hello" + " World", { $maxChars: 20 })
      const expr = concat(t.stringLiteral('Hello'), t.stringLiteral(' World'));
      const options = t.objectExpression([
        t.objectProperty(t.identifier('$maxChars'), t.numericLiteral(20)),
      ]);
      const result = validateUseGTCallback(
        makeCallWithOptions(expr, options),
        state
      );

      expect(result.errors).toHaveLength(0);
      expect(result.content).toBe('Hello World');
      expect(result.maxChars).toBe(20);
    });

    it('should extract all options alongside complex first argument', () => {
      // gt("A" + `B ${"C"}`, { $id: "abc", $context: "test", $maxChars: 50, $format: "STRING" })
      const expr = concat(
        t.stringLiteral('A'),
        template(['B ', ''], t.stringLiteral('C'))
      );
      const options = t.objectExpression([
        t.objectProperty(t.identifier('$id'), t.stringLiteral('abc')),
        t.objectProperty(t.identifier('$context'), t.stringLiteral('test')),
        t.objectProperty(t.identifier('$maxChars'), t.numericLiteral(50)),
        t.objectProperty(t.identifier('$format'), t.stringLiteral('STRING')),
      ]);
      const result = validateUseGTCallback(
        makeCallWithOptions(expr, options),
        state
      );

      expect(result.errors).toHaveLength(0);
      expect(result.content).toBe('AB C');
      expect(result.id).toBe('abc');
      expect(result.context).toBe('test');
      expect(result.maxChars).toBe(50);
      expect(result.format).toBe('STRING');
    });
  });

  // ─────────────────────────────────────────────────
  // 12. REGRESSION TESTS — existing behavior preserved
  // ─────────────────────────────────────────────────

  describe('regression — existing behavior preserved', () => {
    it('plain string literal still works: gt("Hello")', () => {
      const result = validateUseGTCallback(
        makeCall(t.stringLiteral('Hello')),
        state
      );
      expect(result.errors).toHaveLength(0);
      expect(result.content).toBe('Hello');
    });

    it('plain template literal (no expressions) still works: gt(`Hello`)', () => {
      const expr = template(['Hello']);
      const result = validateUseGTCallback(makeCall(expr), state);
      expect(result.errors).toHaveLength(0);
      expect(result.content).toBe('Hello');
    });

    it('string with options still works', () => {
      const options = t.objectExpression([
        t.objectProperty(t.identifier('$context'), t.stringLiteral('greeting')),
        t.objectProperty(t.identifier('$id'), t.stringLiteral('hello-id')),
      ]);
      const result = validateUseGTCallback(
        makeCallWithOptions(t.stringLiteral('Hello'), options),
        state
      );
      expect(result.errors).toHaveLength(0);
      expect(result.content).toBe('Hello');
      expect(result.context).toBe('greeting');
      expect(result.id).toBe('hello-id');
    });

    it('derive as first argument still works', () => {
      const deriveCall = t.callExpression(
        t.identifier(GT_OTHER_FUNCTIONS.derive),
        [t.callExpression(t.identifier('getName'), [])]
      );
      const result = validateUseGTCallback(makeCall(deriveCall), state);
      expect(result.errors).toHaveLength(0);
    });

    it('no arguments still errors', () => {
      const result = validateUseGTCallback(
        t.callExpression(t.identifier('gt'), []),
        state
      );
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('identifier as first argument still errors (without autoderive)', () => {
      const result = validateUseGTCallback(
        makeCall(t.identifier('myVar')),
        state
      );
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.content).toBeUndefined();
    });

    it('autoderive still skips validation for non-string content', () => {
      const autoState = createState({
        autoderive: { jsx: false, strings: true },
      });
      const result = validateUseGTCallback(
        makeCall(t.identifier('myVar')),
        autoState
      );
      expect(result.errors).toHaveLength(0);
      expect(result.content).toBeUndefined();
      expect(result.hasDeriveContext).toBe(true);
    });
  });
});
