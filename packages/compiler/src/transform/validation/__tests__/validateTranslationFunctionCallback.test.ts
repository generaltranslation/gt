import { describe, it, expect, beforeEach } from 'vitest';
import * as t from '@babel/types';
import { parse } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import {
  validateUseGTCallback,
  validateUseTranslationsCallback,
  validateUseMessagesCallback,
} from '../validateTranslationFunctionCallback';
import { TransformState } from '../../../state/types';
import { StringCollector } from '../../../state/StringCollector';
import { Logger } from '../../../state/Logger';
import { ErrorTracker } from '../../../state/ErrorTracker';
import { ScopeTracker } from '../../../state/ScopeTracker';
import { PluginSettings } from '../../../config';
import { GT_OTHER_FUNCTIONS } from '../../../utils/constants/gt/constants';

/**
 * Wraps a raw t.CallExpression node in a file and traverses to get a NodePath,
 * then calls validateUseGTCallback with the proper NodePath.
 */
function validateCall(
  callExpr: t.CallExpression,
  state: TransformState
): ReturnType<typeof validateUseGTCallback> {
  const file = t.file(t.program([t.expressionStatement(callExpr)]));
  let result: ReturnType<typeof validateUseGTCallback> | undefined;
  traverse(file, {
    CallExpression(path) {
      result = validateUseGTCallback(path, state);
      path.stop();
    },
  });
  return result!;
}

/**
 * Wraps a raw t.CallExpression node in a file and traverses to get a NodePath,
 * then calls validateUseTranslationsCallback with the proper NodePath.
 */
function validateTranslationsCall(
  callExpr: t.CallExpression
): ReturnType<typeof validateUseTranslationsCallback> {
  const file = t.file(t.program([t.expressionStatement(callExpr)]));
  let result: ReturnType<typeof validateUseTranslationsCallback> | undefined;
  traverse(file, {
    CallExpression(path) {
      result = validateUseTranslationsCallback(path);
      path.stop();
    },
  });
  return result!;
}

/**
 * Wraps a raw t.CallExpression node in a file and traverses to get a NodePath,
 * then calls validateUseMessagesCallback with the proper NodePath.
 */
function validateMessagesCall(
  callExpr: t.CallExpression
): ReturnType<typeof validateUseMessagesCallback> {
  const file = t.file(t.program([t.expressionStatement(callExpr)]));
  let result: ReturnType<typeof validateUseMessagesCallback> | undefined;
  traverse(file, {
    CallExpression(path) {
      result = validateUseMessagesCallback(path);
      path.stop();
    },
  });
  return result!;
}

/**
 * Parses a full code string (with imports) and validates the outermost
 * useGT_callback / getGT_callback call expression found in the AST.
 * This is needed for derive tests because isDeriveInvocation checks
 * scope bindings which require actual import declarations.
 */
function parseAndValidateCall(
  code: string,
  state: TransformState
): ReturnType<typeof validateUseGTCallback> {
  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['typescript'],
  });
  let result: ReturnType<typeof validateUseGTCallback> | undefined;
  traverse(ast, {
    CallExpression(path) {
      const callee = path.node.callee;
      if (
        t.isIdentifier(callee) &&
        (callee.name === 'useGT_callback' || callee.name === 'getGT_callback')
      ) {
        result = validateUseGTCallback(path, state);
        path.stop();
      }
    },
  });
  return result!;
}

describe('validateTranslationFunctionCallback', () => {
  let state: TransformState;

  beforeEach(() => {
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
    };

    state = {
      settings,
      stringCollector,
      scopeTracker,
      logger,
      errorTracker,
      statistics: {
        jsxElementCount: 0,
        dynamicContentViolations: 0,
        runtimeTranslateCount: 0,
        macroExpansionsCount: 0,
        jsxInsertionsCount: 0,
      },
    };

    // Register derive in scope tracker for testing
    // Use trackTranslationVariable to register it as a known GT function
    scopeTracker.trackTranslationVariable(
      GT_OTHER_FUNCTIONS.derive,
      GT_OTHER_FUNCTIONS.derive,
      0
    );
  });

  describe('validateUseGTCallback', () => {
    describe('basic validation', () => {
      it('should return error when no arguments provided', () => {
        const callExpr = t.callExpression(t.identifier('useGT_callback'), []);

        const result = validateCall(callExpr, state);

        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toBe(
          'useGT_callback / getGT_callback must have at least 1 argument'
        );
        expect(result.variants).toBeUndefined();
      });

      it('should return error when first argument is not an expression', () => {
        const callExpr = t.callExpression(t.identifier('useGT_callback'), [
          t.spreadElement(t.identifier('args')),
        ]);

        const result = validateCall(callExpr, state);

        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toBe(
          'useGT_callback / getGT_callback must use a string literal or derive() call as the first argument. Variable content is not allowed.'
        );
        expect(result.variants).toBeUndefined();
      });

      it('should accept string literal as first argument', () => {
        const callExpr = t.callExpression(t.identifier('useGT_callback'), [
          t.stringLiteral('Hello world'),
        ]);

        const result = validateCall(callExpr, state);

        expect(result.errors).toHaveLength(0);
        expect(result.variants?.[0]?.content).toBe('Hello world');
        expect(result.variants?.[0]?.context).toBeUndefined();
        expect(result.id).toBeUndefined();
      });

      it('should accept template literal without expressions as first argument', () => {
        const callExpr = t.callExpression(t.identifier('useGT_callback'), [
          t.templateLiteral(
            [t.templateElement({ raw: 'Hello world', cooked: 'Hello world' })],
            []
          ),
        ]);

        const result = validateCall(callExpr, state);

        expect(result.errors).toHaveLength(0);
        expect(result.variants?.[0]?.content).toBe('Hello world');
      });

      it('should accept identifier as first argument but content is undefined', () => {
        const callExpr = t.callExpression(t.identifier('useGT_callback'), [
          t.identifier('myString'),
        ]);

        const result = validateCall(callExpr, state);

        // When an identifier is passed, it is classified as dynamic,
        // and with autoderive.strings disabled this causes an error
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should accept template literal with expressions but content is undefined', () => {
        const callExpr = t.callExpression(t.identifier('useGT_callback'), [
          t.templateLiteral(
            [
              t.templateElement({ raw: 'Hello ', cooked: 'Hello ' }),
              t.templateElement({ raw: '', cooked: '' }),
            ],
            [t.identifier('name')]
          ),
        ]);

        const result = validateCall(callExpr, state);

        // Template literal with expressions that don't contain derive
        // fails validation when autoderive is disabled
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    describe('derive validation', () => {
      it('should accept direct derive call as first argument', () => {
        const code = `
          import { derive } from 'gt-react';
          useGT_callback(derive(getName()));
        `;

        const result = parseAndValidateCall(code, state);

        expect(result.errors).toHaveLength(0);
      });

      it('should accept string concatenation with derive', () => {
        const code = `
          import { derive } from 'gt-react';
          useGT_callback("Hello " + derive(getName()));
        `;

        const result = parseAndValidateCall(code, state);

        expect(result.errors).toHaveLength(0);
      });

      it('should accept template literal with derive', () => {
        const code = `
          import { derive } from 'gt-react';
          useGT_callback(\`Hello \${derive(getName())}!\`);
        `;

        const result = parseAndValidateCall(code, state);

        expect(result.errors).toHaveLength(0);
      });

      it('should return error when using non-derive call expression', () => {
        const otherCall = t.callExpression(t.identifier('someOtherFunction'), [
          t.stringLiteral('arg'),
        ]);

        const callExpr = t.callExpression(t.identifier('useGT_callback'), [
          otherCall,
        ]);

        const result = validateCall(callExpr, state);

        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should accept derive with await expression', () => {
        const code = `
          import { derive } from 'gt-react';
          useGT_callback(derive(await getName()));
        `;

        const result = parseAndValidateCall(code, state);

        expect(result.errors).toHaveLength(0);
      });

      it('should accept template literal with derive containing await', () => {
        const code = `
          import { derive } from 'gt-react';
          useGT_callback(\`Hello \${derive(await getName())}!\`);
        `;

        const result = parseAndValidateCall(code, state);

        expect(result.errors).toHaveLength(0);
      });

      it('should accept string concatenation with derive containing await', () => {
        const code = `
          import { derive } from 'gt-react';
          useGT_callback("Current time: " + derive(await getTime()));
        `;

        const result = parseAndValidateCall(code, state);

        expect(result.errors).toHaveLength(0);
      });
    });

    describe('backwards compatibility - declareStatic', () => {
      beforeEach(() => {
        // Also register declareStatic in scope tracker for backwards compat
        state.scopeTracker.trackTranslationVariable(
          GT_OTHER_FUNCTIONS.declareStatic,
          GT_OTHER_FUNCTIONS.declareStatic,
          0
        );
      });

      it('should accept direct declareStatic call as first argument', () => {
        const code = `
          import { declareStatic } from 'gt-react';
          useGT_callback(declareStatic(getName()));
        `;

        const result = parseAndValidateCall(code, state);

        expect(result.errors).toHaveLength(0);
      });

      it('should accept template literal with declareStatic', () => {
        const code = `
          import { declareStatic } from 'gt-react';
          useGT_callback(\`Hello \${declareStatic(getName())}!\`);
        `;

        const result = parseAndValidateCall(code, state);

        expect(result.errors).toHaveLength(0);
      });

      it('should accept string concatenation with declareStatic', () => {
        const code = `
          import { declareStatic } from 'gt-react';
          useGT_callback("Hello " + declareStatic(getName()));
        `;

        const result = parseAndValidateCall(code, state);

        expect(result.errors).toHaveLength(0);
      });
    });

    describe('second argument validation', () => {
      it('should accept call with only first argument', () => {
        const callExpr = t.callExpression(t.identifier('useGT_callback'), [
          t.stringLiteral('Hello'),
        ]);

        const result = validateCall(callExpr, state);

        expect(result.errors).toHaveLength(0);
        expect(result.variants?.[0]?.content).toBe('Hello');
        expect(result.variants?.[0]?.context).toBeUndefined();
        expect(result.id).toBeUndefined();
        expect(result.hash).toBeUndefined();
      });

      it('should extract $context from second argument', () => {
        const callExpr = t.callExpression(t.identifier('useGT_callback'), [
          t.stringLiteral('Hello'),
          t.objectExpression([
            t.objectProperty(
              t.identifier('$context'),
              t.stringLiteral('greeting')
            ),
          ]),
        ]);

        const result = validateCall(callExpr, state);

        expect(result.errors).toHaveLength(0);
        expect(result.variants?.[0]?.content).toBe('Hello');
        expect(result.variants?.[0]?.context).toBe('greeting');
        expect(result.id).toBeUndefined();
      });

      it('should extract $id from second argument', () => {
        const callExpr = t.callExpression(t.identifier('useGT_callback'), [
          t.stringLiteral('Hello'),
          t.objectExpression([
            t.objectProperty(t.identifier('$id'), t.stringLiteral('hello-id')),
          ]),
        ]);

        const result = validateCall(callExpr, state);

        expect(result.errors).toHaveLength(0);
        expect(result.variants?.[0]?.content).toBe('Hello');
        expect(result.id).toBe('hello-id');
        expect(result.variants?.[0]?.context).toBeUndefined();
      });

      it('should extract $_hash from second argument', () => {
        const callExpr = t.callExpression(t.identifier('useGT_callback'), [
          t.stringLiteral('Hello'),
          t.objectExpression([
            t.objectProperty(t.identifier('$_hash'), t.stringLiteral('abc123')),
          ]),
        ]);

        const result = validateCall(callExpr, state);

        expect(result.errors).toHaveLength(0);
        expect(result.variants?.[0]?.content).toBe('Hello');
        expect(result.hash).toBe('abc123');
      });

      it('should extract multiple properties from second argument', () => {
        const callExpr = t.callExpression(t.identifier('useGT_callback'), [
          t.stringLiteral('Hello'),
          t.objectExpression([
            t.objectProperty(
              t.identifier('$context'),
              t.stringLiteral('greeting')
            ),
            t.objectProperty(t.identifier('$id'), t.stringLiteral('hello-id')),
            t.objectProperty(t.identifier('$_hash'), t.stringLiteral('abc123')),
          ]),
        ]);

        const result = validateCall(callExpr, state);

        expect(result.errors).toHaveLength(0);
        expect(result.variants?.[0]?.content).toBe('Hello');
        expect(result.variants?.[0]?.context).toBe('greeting');
        expect(result.id).toBe('hello-id');
        expect(result.hash).toBe('abc123');
      });

      it('should accept string literal keys for properties', () => {
        const callExpr = t.callExpression(t.identifier('useGT_callback'), [
          t.stringLiteral('Hello'),
          t.objectExpression([
            t.objectProperty(
              t.stringLiteral('$context'),
              t.stringLiteral('greeting')
            ),
          ]),
        ]);

        const result = validateCall(callExpr, state);

        expect(result.errors).toHaveLength(0);
        expect(result.variants?.[0]?.context).toBe('greeting');
      });

      it('should return error when $context is not a static expression', () => {
        const callExpr = t.callExpression(t.identifier('useGT_callback'), [
          t.stringLiteral('Hello'),
          t.objectExpression([
            t.objectProperty(
              t.identifier('$context'),
              t.identifier('contextVar')
            ),
          ]),
        ]);

        const result = validateCall(callExpr, state);

        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should return error when $id is not a string literal', () => {
        const callExpr = t.callExpression(t.identifier('useGT_callback'), [
          t.stringLiteral('Hello'),
          t.objectExpression([
            t.objectProperty(t.identifier('$id'), t.identifier('idVar')),
          ]),
        ]);

        const result = validateCall(callExpr, state);

        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors.some((e) => e.includes('string literal'))).toBe(
          true
        );
      });

      it('should accept template literal without expressions for $context', () => {
        const callExpr = t.callExpression(t.identifier('useGT_callback'), [
          t.stringLiteral('Hello'),
          t.objectExpression([
            t.objectProperty(
              t.identifier('$context'),
              t.templateLiteral(
                [
                  t.templateElement({
                    raw: 'greeting',
                    cooked: 'greeting',
                  }),
                ],
                []
              )
            ),
          ]),
        ]);

        const result = validateCall(callExpr, state);

        expect(result.errors).toHaveLength(0);
        expect(result.variants?.[0]?.context).toBe('greeting');
      });

      it('should handle empty object as second argument', () => {
        const callExpr = t.callExpression(t.identifier('useGT_callback'), [
          t.stringLiteral('Hello'),
          t.objectExpression([]),
        ]);

        const result = validateCall(callExpr, state);

        expect(result.errors).toHaveLength(0);
        expect(result.variants?.[0]?.content).toBe('Hello');
        expect(result.variants?.[0]?.context).toBeUndefined();
        expect(result.id).toBeUndefined();
      });

      it('should ignore non-object properties in second argument', () => {
        const callExpr = t.callExpression(t.identifier('useGT_callback'), [
          t.stringLiteral('Hello'),
          t.objectExpression([
            t.objectProperty(
              t.identifier('$context'),
              t.stringLiteral('greeting')
            ),
            t.spreadElement(t.identifier('otherProps')),
          ]),
        ]);

        const result = validateCall(callExpr, state);

        expect(result.errors).toHaveLength(0);
        expect(result.variants?.[0]?.context).toBe('greeting');
      });

      it('should handle properties with computed keys gracefully', () => {
        const callExpr = t.callExpression(t.identifier('useGT_callback'), [
          t.stringLiteral('Hello'),
          t.objectExpression([
            t.objectProperty(
              t.identifier('$context'),
              t.stringLiteral('greeting')
            ),
            t.objectProperty(
              t.binaryExpression(
                '+',
                t.stringLiteral('$'),
                t.stringLiteral('id')
              ),
              t.stringLiteral('computed-id'),
              true // computed
            ),
          ]),
        ]);

        const result = validateCall(callExpr, state);

        // Should still extract $context, but ignore computed key
        expect(result.errors).toHaveLength(0);
        expect(result.variants?.[0]?.context).toBe('greeting');
      });
    });

    describe('derive in context', () => {
      it('should not error when $context contains a derive() call', () => {
        const deriveCall = t.callExpression(
          t.identifier(GT_OTHER_FUNCTIONS.derive),
          [t.callExpression(t.identifier('getFormality'), [])]
        );

        const callExpr = t.callExpression(t.identifier('useGT_callback'), [
          t.stringLiteral('Hello'),
          t.objectExpression([
            t.objectProperty(t.identifier('$context'), deriveCall),
          ]),
        ]);

        const result = validateCall(callExpr, state);

        expect(result.errors).toHaveLength(0);
        expect(result.hasDerive).toBe(true);
      });

      it('should not error when $context contains derive() wrapping a function call', () => {
        const deriveCall = t.callExpression(
          t.identifier(GT_OTHER_FUNCTIONS.derive),
          [t.callExpression(t.identifier('getTone'), [])]
        );

        const callExpr = t.callExpression(t.identifier('useGT_callback'), [
          t.stringLiteral('Hello'),
          t.objectExpression([
            t.objectProperty(t.identifier('$context'), deriveCall),
          ]),
        ]);

        const result = validateCall(callExpr, state);

        expect(result.errors).toHaveLength(0);
        expect(result.hasDerive).toBe(true);
      });

      it('should not error when $context contains derive() in string concatenation', () => {
        const deriveCall = t.callExpression(
          t.identifier(GT_OTHER_FUNCTIONS.derive),
          [t.callExpression(t.identifier('getFormality'), [])]
        );

        const concatExpr = t.binaryExpression(
          '+',
          t.stringLiteral('prefix-'),
          deriveCall
        );

        const callExpr = t.callExpression(t.identifier('useGT_callback'), [
          t.stringLiteral('Hello'),
          t.objectExpression([
            t.objectProperty(t.identifier('$context'), concatExpr),
          ]),
        ]);

        const result = validateCall(callExpr, state);

        expect(result.errors).toHaveLength(0);
        expect(result.hasDerive).toBe(true);
      });

      it('should not error when $context contains derive() in template literal', () => {
        const deriveCall = t.callExpression(
          t.identifier(GT_OTHER_FUNCTIONS.derive),
          [t.callExpression(t.identifier('getFormality'), [])]
        );

        const templateLiteral = t.templateLiteral(
          [
            t.templateElement({ raw: 'prefix-', cooked: 'prefix-' }),
            t.templateElement({ raw: '', cooked: '' }),
          ],
          [deriveCall]
        );

        const callExpr = t.callExpression(t.identifier('useGT_callback'), [
          t.stringLiteral('Hello'),
          t.objectExpression([
            t.objectProperty(t.identifier('$context'), templateLiteral),
          ]),
        ]);

        const result = validateCall(callExpr, state);

        expect(result.errors).toHaveLength(0);
        expect(result.hasDerive).toBe(true);
      });

      it('should still accept static string $context (regression)', () => {
        const callExpr = t.callExpression(t.identifier('useGT_callback'), [
          t.stringLiteral('Hello'),
          t.objectExpression([
            t.objectProperty(
              t.identifier('$context'),
              t.stringLiteral('greeting')
            ),
          ]),
        ]);

        const result = validateCall(callExpr, state);

        expect(result.errors).toHaveLength(0);
        expect(result.variants?.[0]?.context).toBe('greeting');
      });
    });
  });

  describe('validateUseTranslationsCallback', () => {
    it('should always return no errors with no arguments', () => {
      const callExpr = t.callExpression(
        t.identifier('useTranslations_callback'),
        []
      );

      const result = validateTranslationsCall(callExpr);

      expect(result.errors).toHaveLength(0);
    });

    it('should always return no errors with arguments', () => {
      const callExpr = t.callExpression(
        t.identifier('useTranslations_callback'),
        [t.identifier('someVar'), t.objectExpression([])]
      );

      const result = validateTranslationsCall(callExpr);

      expect(result.errors).toHaveLength(0);
    });

    it('should accept any type of arguments', () => {
      const callExpr = t.callExpression(
        t.identifier('useTranslations_callback'),
        [t.stringLiteral('test'), t.numericLiteral(123), t.arrayExpression([])]
      );

      const result = validateTranslationsCall(callExpr);

      expect(result.errors).toHaveLength(0);
    });
  });

  describe('validateUseMessagesCallback', () => {
    it('should always return no errors with no arguments', () => {
      const callExpr = t.callExpression(
        t.identifier('useMessages_callback'),
        []
      );

      const result = validateMessagesCall(callExpr);

      expect(result.errors).toHaveLength(0);
    });

    it('should always return no errors with arguments', () => {
      const callExpr = t.callExpression(t.identifier('useMessages_callback'), [
        t.identifier('someVar'),
        t.objectExpression([]),
      ]);

      const result = validateMessagesCall(callExpr);

      expect(result.errors).toHaveLength(0);
    });

    it('should accept any type of arguments', () => {
      const callExpr = t.callExpression(t.identifier('useMessages_callback'), [
        t.stringLiteral('test'),
        t.numericLiteral(123),
        t.booleanLiteral(true),
      ]);

      const result = validateMessagesCall(callExpr);

      expect(result.errors).toHaveLength(0);
    });

    it('should not error on template literal with bare variable when autoderive is enabled', () => {
      // msg(`Hello, ${name}`) — should pass regardless of autoderive
      const callExpr = t.callExpression(t.identifier('useMessages_callback'), [
        t.templateLiteral(
          [
            t.templateElement({ raw: 'Hello, ', cooked: 'Hello, ' }),
            t.templateElement({ raw: '', cooked: '' }),
          ],
          [t.identifier('name')]
        ),
      ]);

      const result = validateMessagesCall(callExpr);

      expect(result.errors).toHaveLength(0);
    });
  });

  describe('autoderive', () => {
    let autoderiveState: TransformState;

    beforeEach(() => {
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
        autoderive: { jsx: true, strings: true },
        _debugHashManifest: false,
        devHotReload: { strings: false, jsx: false },
      };

      autoderiveState = {
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

      scopeTracker.trackTranslationVariable(
        GT_OTHER_FUNCTIONS.derive,
        GT_OTHER_FUNCTIONS.derive,
        0
      );
    });

    it('should accept template literal with bare variable when autoderive is enabled', () => {
      // gt(`Hello, ${name}`)
      const callExpr = t.callExpression(t.identifier('useGT_callback'), [
        t.templateLiteral(
          [
            t.templateElement({ raw: 'Hello, ', cooked: 'Hello, ' }),
            t.templateElement({ raw: '', cooked: '' }),
          ],
          [t.identifier('name')]
        ),
      ]);

      const result = validateCall(callExpr, autoderiveState);

      expect(result.errors).toHaveLength(0);
      expect(result.hasDerive).toBe(false);
    });

    it('should accept concatenation with bare variable when autoderive is enabled', () => {
      // gt("Hello, " + name)
      const callExpr = t.callExpression(t.identifier('useGT_callback'), [
        t.binaryExpression(
          '+',
          t.stringLiteral('Hello, '),
          t.identifier('name')
        ),
      ]);

      const result = validateCall(callExpr, autoderiveState);

      expect(result.errors).toHaveLength(0);
      expect(result.hasDerive).toBe(false);
    });

    it('should accept template literal with bare function call when autoderive is enabled', () => {
      // gt(`Hello, ${getName()}`)
      const callExpr = t.callExpression(t.identifier('useGT_callback'), [
        t.templateLiteral(
          [
            t.templateElement({ raw: 'Hello, ', cooked: 'Hello, ' }),
            t.templateElement({ raw: '', cooked: '' }),
          ],
          [t.callExpression(t.identifier('getName'), [])]
        ),
      ]);

      const result = validateCall(callExpr, autoderiveState);

      expect(result.errors).toHaveLength(0);
      expect(result.hasDerive).toBe(false);
    });

    it('should accept concatenation with bare function call when autoderive is enabled', () => {
      // gt("Hello, " + getName())
      const callExpr = t.callExpression(t.identifier('useGT_callback'), [
        t.binaryExpression(
          '+',
          t.stringLiteral('Hello, '),
          t.callExpression(t.identifier('getName'), [])
        ),
      ]);

      const result = validateCall(callExpr, autoderiveState);

      expect(result.errors).toHaveLength(0);
      expect(result.hasDerive).toBe(false);
    });

    it('should reject template literal with bare variable when autoderive is disabled', () => {
      // gt(`Hello, ${name}`) with autoderive off (default state)
      const callExpr = t.callExpression(t.identifier('useGT_callback'), [
        t.templateLiteral(
          [
            t.templateElement({ raw: 'Hello, ', cooked: 'Hello, ' }),
            t.templateElement({ raw: '', cooked: '' }),
          ],
          [t.identifier('name')]
        ),
      ]);

      const result = validateCall(callExpr, state);

      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject concatenation with bare variable when autoderive is disabled', () => {
      // gt("Hello, " + name) with autoderive off (default state)
      const callExpr = t.callExpression(t.identifier('useGT_callback'), [
        t.binaryExpression(
          '+',
          t.stringLiteral('Hello, '),
          t.identifier('name')
        ),
      ]);

      const result = validateCall(callExpr, state);

      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should accept mixed explicit derive and bare variable when autoderive is enabled', () => {
      // gt(`Hello, ${derive(getName())} and ${name}`)
      const code = `
        import { derive } from 'gt-react';
        useGT_callback(\`Hello, \${derive(getName())} and \${name}\`);
      `;

      const result = parseAndValidateCall(code, autoderiveState);

      expect(result.errors).toHaveLength(0);
      expect(result.hasDerive).toBe(true);
    });

    it('should accept getGT_callback with template literal and bare variable when autoderive is enabled', () => {
      // const gt = getGT(); gt(`Hello, ${name}`)
      const callExpr = t.callExpression(t.identifier('getGT_callback'), [
        t.templateLiteral(
          [
            t.templateElement({ raw: 'Hello, ', cooked: 'Hello, ' }),
            t.templateElement({ raw: '', cooked: '' }),
          ],
          [t.identifier('name')]
        ),
      ]);

      const result = validateCall(callExpr, autoderiveState);

      expect(result.errors).toHaveLength(0);
      expect(result.hasDerive).toBe(false);
    });

    it('should still reject bare variable in $context when autoderive is enabled', () => {
      // autoderive only applies to content, not $context
      const callExpr = t.callExpression(t.identifier('useGT_callback'), [
        t.stringLiteral('Hello'),
        t.objectExpression([
          t.objectProperty(
            t.identifier('$context'),
            t.identifier('contextVar')
          ),
        ]),
      ]);

      const result = validateCall(callExpr, autoderiveState);

      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('$format option', () => {
    it('should extract $format from options object', () => {
      const callExpr = t.callExpression(t.identifier('useGT_callback'), [
        t.stringLiteral('Hello world'),
        t.objectExpression([
          t.objectProperty(t.identifier('$format'), t.stringLiteral('STRING')),
        ]),
      ]);
      const result = validateCall(callExpr, state);
      expect(result.errors).toHaveLength(0);
      expect(result.variants?.[0]?.content).toBe('Hello world');
      expect(result.format).toBe('STRING');
    });

    it('should return undefined format when $format not provided', () => {
      const callExpr = t.callExpression(t.identifier('useGT_callback'), [
        t.stringLiteral('Hello world'),
        t.objectExpression([
          t.objectProperty(
            t.identifier('$context'),
            t.stringLiteral('greeting')
          ),
        ]),
      ]);
      const result = validateCall(callExpr, state);
      expect(result.errors).toHaveLength(0);
      expect(result.format).toBeUndefined();
    });

    it('should extract $format alongside other options', () => {
      const callExpr = t.callExpression(t.identifier('useGT_callback'), [
        t.stringLiteral('Hello'),
        t.objectExpression([
          t.objectProperty(t.identifier('$id'), t.stringLiteral('hello')),
          t.objectProperty(
            t.identifier('$context'),
            t.stringLiteral('greeting')
          ),
          t.objectProperty(t.identifier('$format'), t.stringLiteral('I18NEXT')),
        ]),
      ]);
      const result = validateCall(callExpr, state);
      expect(result.errors).toHaveLength(0);
      expect(result.id).toBe('hello');
      expect(result.variants?.[0]?.context).toBe('greeting');
      expect(result.format).toBe('I18NEXT');
    });

    it('should error when $format is not a string literal', () => {
      const callExpr = t.callExpression(t.identifier('useGT_callback'), [
        t.stringLiteral('Hello'),
        t.objectExpression([
          t.objectProperty(t.identifier('$format'), t.identifier('someVar')),
        ]),
      ]);
      const result = validateCall(callExpr, state);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('selective autoderive — { jsx: true, strings: false }', () => {
    let jsxOnlyState: TransformState;

    beforeEach(() => {
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
        autoderive: { jsx: true, strings: false },
        _debugHashManifest: false,
        devHotReload: { strings: false, jsx: false },
      };

      jsxOnlyState = {
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

      scopeTracker.trackTranslationVariable(
        GT_OTHER_FUNCTIONS.derive,
        GT_OTHER_FUNCTIONS.derive,
        0
      );
    });

    it('should reject template literal with bare variable (strings disabled)', () => {
      const callExpr = t.callExpression(t.identifier('useGT_callback'), [
        t.templateLiteral(
          [
            t.templateElement({ raw: 'Hello, ', cooked: 'Hello, ' }),
            t.templateElement({ raw: '', cooked: '' }),
          ],
          [t.identifier('name')]
        ),
      ]);

      const result = validateCall(callExpr, jsxOnlyState);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject concatenation with bare variable (strings disabled)', () => {
      const callExpr = t.callExpression(t.identifier('useGT_callback'), [
        t.binaryExpression(
          '+',
          t.stringLiteral('Hello, '),
          t.identifier('name')
        ),
      ]);

      const result = validateCall(callExpr, jsxOnlyState);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('selective autoderive — { jsx: false, strings: true }', () => {
    let stringsOnlyState: TransformState;

    beforeEach(() => {
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
        autoderive: { jsx: false, strings: true },
        _debugHashManifest: false,
        devHotReload: { strings: false, jsx: false },
      };

      stringsOnlyState = {
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

      scopeTracker.trackTranslationVariable(
        GT_OTHER_FUNCTIONS.derive,
        GT_OTHER_FUNCTIONS.derive,
        0
      );
    });

    it('should accept template literal with bare variable (strings enabled)', () => {
      const callExpr = t.callExpression(t.identifier('useGT_callback'), [
        t.templateLiteral(
          [
            t.templateElement({ raw: 'Hello, ', cooked: 'Hello, ' }),
            t.templateElement({ raw: '', cooked: '' }),
          ],
          [t.identifier('name')]
        ),
      ]);

      const result = validateCall(callExpr, stringsOnlyState);
      expect(result.errors).toHaveLength(0);
      expect(result.hasDerive).toBe(false);
    });

    it('should accept concatenation with bare variable (strings enabled)', () => {
      const callExpr = t.callExpression(t.identifier('useGT_callback'), [
        t.binaryExpression(
          '+',
          t.stringLiteral('Hello, '),
          t.identifier('name')
        ),
      ]);

      const result = validateCall(callExpr, stringsOnlyState);
      expect(result.errors).toHaveLength(0);
      expect(result.hasDerive).toBe(false);
    });
  });
});
