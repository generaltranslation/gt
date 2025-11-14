import { describe, it, expect, beforeEach } from 'vitest';
import * as t from '@babel/types';
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
      },
    };

    // Register declareStatic in scope tracker for testing
    // Use trackTranslationVariable to register it as a known GT function
    scopeTracker.trackTranslationVariable(
      GT_OTHER_FUNCTIONS.declareStatic,
      GT_OTHER_FUNCTIONS.declareStatic,
      0
    );
  });

  describe('validateUseGTCallback', () => {
    describe('basic validation', () => {
      it('should return error when no arguments provided', () => {
        const callExpr = t.callExpression(t.identifier('useGT_callback'), []);

        const result = validateUseGTCallback(callExpr, state);

        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toBe(
          'useGT_callback / getGT_callback must have at least 1 argument'
        );
        expect(result.content).toBeUndefined();
      });

      it('should return error when first argument is not an expression', () => {
        const callExpr = t.callExpression(t.identifier('useGT_callback'), [
          t.spreadElement(t.identifier('args')),
        ]);

        const result = validateUseGTCallback(callExpr, state);

        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toBe(
          'useGT_callback / getGT_callback must have a string literal as the first argument. Variable content is not allowed.'
        );
        expect(result.content).toBeUndefined();
      });

      it('should accept string literal as first argument', () => {
        const callExpr = t.callExpression(t.identifier('useGT_callback'), [
          t.stringLiteral('Hello world'),
        ]);

        const result = validateUseGTCallback(callExpr, state);

        expect(result.errors).toHaveLength(0);
        expect(result.content).toBe('Hello world');
        expect(result.context).toBeUndefined();
        expect(result.id).toBeUndefined();
      });

      it('should accept template literal without expressions as first argument', () => {
        const callExpr = t.callExpression(t.identifier('useGT_callback'), [
          t.templateLiteral(
            [t.templateElement({ raw: 'Hello world', cooked: 'Hello world' })],
            []
          ),
        ]);

        const result = validateUseGTCallback(callExpr, state);

        expect(result.errors).toHaveLength(0);
        expect(result.content).toBe('Hello world');
      });

      it('should accept identifier as first argument but content is undefined', () => {
        const callExpr = t.callExpression(t.identifier('useGT_callback'), [
          t.identifier('myString'),
        ]);

        const result = validateUseGTCallback(callExpr, state);

        // When an identifier is passed, validateDeclareStatic doesn't add errors
        // So the validation passes but content is undefined
        expect(result.errors).toHaveLength(0);
        expect(result.content).toBeUndefined();
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

        const result = validateUseGTCallback(callExpr, state);

        // Template literal with expressions that don't contain declareStatic
        // passes validation but content is undefined
        expect(result.errors).toHaveLength(0);
        expect(result.content).toBeUndefined();
      });
    });

    describe('declareStatic validation', () => {
      it('should accept direct declareStatic call as first argument', () => {
        const declareStaticCall = t.callExpression(
          t.identifier(GT_OTHER_FUNCTIONS.declareStatic),
          [t.callExpression(t.identifier('getName'), [])]
        );

        const callExpr = t.callExpression(t.identifier('useGT_callback'), [
          declareStaticCall,
        ]);

        const result = validateUseGTCallback(callExpr, state);

        expect(result.errors).toHaveLength(0);
      });

      it('should accept string concatenation with declareStatic', () => {
        const declareStaticCall = t.callExpression(
          t.identifier(GT_OTHER_FUNCTIONS.declareStatic),
          [t.callExpression(t.identifier('getName'), [])]
        );

        const binaryExpr = t.binaryExpression(
          '+',
          t.stringLiteral('Hello '),
          declareStaticCall
        );

        const callExpr = t.callExpression(t.identifier('useGT_callback'), [
          binaryExpr,
        ]);

        const result = validateUseGTCallback(callExpr, state);

        expect(result.errors).toHaveLength(0);
      });

      it('should accept template literal with declareStatic', () => {
        const declareStaticCall = t.callExpression(
          t.identifier(GT_OTHER_FUNCTIONS.declareStatic),
          [t.callExpression(t.identifier('getName'), [])]
        );

        const templateLiteral = t.templateLiteral(
          [
            t.templateElement({ raw: 'Hello ', cooked: 'Hello ' }),
            t.templateElement({ raw: '!', cooked: '!' }),
          ],
          [declareStaticCall]
        );

        const callExpr = t.callExpression(t.identifier('useGT_callback'), [
          templateLiteral,
        ]);

        const result = validateUseGTCallback(callExpr, state);

        expect(result.errors).toHaveLength(0);
      });

      it('should return error when declareStatic has no arguments', () => {
        const declareStaticCall = t.callExpression(
          t.identifier(GT_OTHER_FUNCTIONS.declareStatic),
          []
        );

        const callExpr = t.callExpression(t.identifier('useGT_callback'), [
          declareStaticCall,
        ]);

        const result = validateUseGTCallback(callExpr, state);

        expect(result.errors.length).toBeGreaterThan(0);
        expect(
          result.errors.some((e) =>
            e.includes('DeclareStatic must have one argument')
          )
        ).toBe(true);
      });

      it('should return error when declareStatic has more than one argument', () => {
        const declareStaticCall = t.callExpression(
          t.identifier(GT_OTHER_FUNCTIONS.declareStatic),
          [
            t.callExpression(t.identifier('getName'), []),
            t.stringLiteral('extra'),
          ]
        );

        const callExpr = t.callExpression(t.identifier('useGT_callback'), [
          declareStaticCall,
        ]);

        const result = validateUseGTCallback(callExpr, state);

        expect(result.errors.length).toBeGreaterThan(0);
        expect(
          result.errors.some((e) =>
            e.includes('DeclareStatic must have one argument')
          )
        ).toBe(true);
      });

      it('should return error when declareStatic argument is not a call expression', () => {
        const declareStaticCall = t.callExpression(
          t.identifier(GT_OTHER_FUNCTIONS.declareStatic),
          [t.stringLiteral('not a call')]
        );

        const callExpr = t.callExpression(t.identifier('useGT_callback'), [
          declareStaticCall,
        ]);

        const result = validateUseGTCallback(callExpr, state);

        expect(result.errors.length).toBeGreaterThan(0);
        expect(
          result.errors.some((e) =>
            e.includes(
              'DeclareStatic must have a call expression as the argument'
            )
          )
        ).toBe(true);
      });

      it('should return error when using non-declareStatic call expression', () => {
        const otherCall = t.callExpression(t.identifier('someOtherFunction'), [
          t.stringLiteral('arg'),
        ]);

        const callExpr = t.callExpression(t.identifier('useGT_callback'), [
          otherCall,
        ]);

        const result = validateUseGTCallback(callExpr, state);

        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    describe('second argument validation', () => {
      it('should accept call with only first argument', () => {
        const callExpr = t.callExpression(t.identifier('useGT_callback'), [
          t.stringLiteral('Hello'),
        ]);

        const result = validateUseGTCallback(callExpr, state);

        expect(result.errors).toHaveLength(0);
        expect(result.content).toBe('Hello');
        expect(result.context).toBeUndefined();
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

        const result = validateUseGTCallback(callExpr, state);

        expect(result.errors).toHaveLength(0);
        expect(result.content).toBe('Hello');
        expect(result.context).toBe('greeting');
        expect(result.id).toBeUndefined();
      });

      it('should extract $id from second argument', () => {
        const callExpr = t.callExpression(t.identifier('useGT_callback'), [
          t.stringLiteral('Hello'),
          t.objectExpression([
            t.objectProperty(t.identifier('$id'), t.stringLiteral('hello-id')),
          ]),
        ]);

        const result = validateUseGTCallback(callExpr, state);

        expect(result.errors).toHaveLength(0);
        expect(result.content).toBe('Hello');
        expect(result.id).toBe('hello-id');
        expect(result.context).toBeUndefined();
      });

      it('should extract $_hash from second argument', () => {
        const callExpr = t.callExpression(t.identifier('useGT_callback'), [
          t.stringLiteral('Hello'),
          t.objectExpression([
            t.objectProperty(t.identifier('$_hash'), t.stringLiteral('abc123')),
          ]),
        ]);

        const result = validateUseGTCallback(callExpr, state);

        expect(result.errors).toHaveLength(0);
        expect(result.content).toBe('Hello');
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

        const result = validateUseGTCallback(callExpr, state);

        expect(result.errors).toHaveLength(0);
        expect(result.content).toBe('Hello');
        expect(result.context).toBe('greeting');
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

        const result = validateUseGTCallback(callExpr, state);

        expect(result.errors).toHaveLength(0);
        expect(result.context).toBe('greeting');
      });

      it('should return error when $context is not a string literal', () => {
        const callExpr = t.callExpression(t.identifier('useGT_callback'), [
          t.stringLiteral('Hello'),
          t.objectExpression([
            t.objectProperty(
              t.identifier('$context'),
              t.identifier('contextVar')
            ),
          ]),
        ]);

        const result = validateUseGTCallback(callExpr, state);

        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors.some((e) => e.includes('string literal'))).toBe(
          true
        );
      });

      it('should return error when $id is not a string literal', () => {
        const callExpr = t.callExpression(t.identifier('useGT_callback'), [
          t.stringLiteral('Hello'),
          t.objectExpression([
            t.objectProperty(t.identifier('$id'), t.identifier('idVar')),
          ]),
        ]);

        const result = validateUseGTCallback(callExpr, state);

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

        const result = validateUseGTCallback(callExpr, state);

        expect(result.errors).toHaveLength(0);
        expect(result.context).toBe('greeting');
      });

      it('should handle empty object as second argument', () => {
        const callExpr = t.callExpression(t.identifier('useGT_callback'), [
          t.stringLiteral('Hello'),
          t.objectExpression([]),
        ]);

        const result = validateUseGTCallback(callExpr, state);

        expect(result.errors).toHaveLength(0);
        expect(result.content).toBe('Hello');
        expect(result.context).toBeUndefined();
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

        const result = validateUseGTCallback(callExpr, state);

        expect(result.errors).toHaveLength(0);
        expect(result.context).toBe('greeting');
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

        const result = validateUseGTCallback(callExpr, state);

        // Should still extract $context, but ignore computed key
        expect(result.errors).toHaveLength(0);
        expect(result.context).toBe('greeting');
      });
    });
  });

  describe('validateUseTranslationsCallback', () => {
    it('should always return no errors with no arguments', () => {
      const callExpr = t.callExpression(
        t.identifier('useTranslations_callback'),
        []
      );

      const result = validateUseTranslationsCallback(callExpr);

      expect(result.errors).toHaveLength(0);
    });

    it('should always return no errors with arguments', () => {
      const callExpr = t.callExpression(
        t.identifier('useTranslations_callback'),
        [t.identifier('someVar'), t.objectExpression([])]
      );

      const result = validateUseTranslationsCallback(callExpr);

      expect(result.errors).toHaveLength(0);
    });

    it('should accept any type of arguments', () => {
      const callExpr = t.callExpression(
        t.identifier('useTranslations_callback'),
        [t.stringLiteral('test'), t.numericLiteral(123), t.arrayExpression([])]
      );

      const result = validateUseTranslationsCallback(callExpr);

      expect(result.errors).toHaveLength(0);
    });
  });

  describe('validateUseMessagesCallback', () => {
    it('should always return no errors with no arguments', () => {
      const callExpr = t.callExpression(
        t.identifier('useMessages_callback'),
        []
      );

      const result = validateUseMessagesCallback(callExpr);

      expect(result.errors).toHaveLength(0);
    });

    it('should always return no errors with arguments', () => {
      const callExpr = t.callExpression(t.identifier('useMessages_callback'), [
        t.identifier('someVar'),
        t.objectExpression([]),
      ]);

      const result = validateUseMessagesCallback(callExpr);

      expect(result.errors).toHaveLength(0);
    });

    it('should accept any type of arguments', () => {
      const callExpr = t.callExpression(t.identifier('useMessages_callback'), [
        t.stringLiteral('test'),
        t.numericLiteral(123),
        t.booleanLiteral(true),
      ]);

      const result = validateUseMessagesCallback(callExpr);

      expect(result.errors).toHaveLength(0);
    });
  });
});
