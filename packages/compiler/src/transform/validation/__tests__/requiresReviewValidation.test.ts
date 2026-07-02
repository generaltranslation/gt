import { describe, it, expect, beforeEach } from 'vitest';
import * as t from '@babel/types';
import { validateTranslationFunction } from '../validateTranslationFunction';
import { validateTranslationComponentArgs } from '../validateTranslationComponentArgs';
import { TransformState } from '../../../state/types';
import { StringCollector } from '../../../state/StringCollector';
import { Logger } from '../../../state/Logger';
import { ErrorTracker } from '../../../state/ErrorTracker';
import { ScopeTracker } from '../../../state/ScopeTracker';
import { PluginSettings } from '../../../config';
import {
  GT_COMPONENT_TYPES,
  GT_OTHER_FUNCTIONS,
} from '../../../utils/constants/gt/constants';
import { getCallExpressionPath } from './testHelpers';

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

function makeGtCall(options: t.ObjectExpression) {
  return getCallExpressionPath(
    t.callExpression(t.identifier('gt'), [t.stringLiteral('hello'), options])
  );
}

function makeTComponentCall(props: t.ObjectProperty[]) {
  return getCallExpressionPath(
    t.callExpression(t.identifier('jsx'), [
      t.identifier(GT_COMPONENT_TYPES.T),
      t.objectExpression([
        t.objectProperty(
          t.identifier('children'),
          t.stringLiteral('some text')
        ),
        ...props,
      ]),
    ])
  );
}

describe('$requiresReview validation — translation functions', () => {
  let state: TransformState;

  beforeEach(() => {
    state = createState();
  });

  it('accepts $requiresReview: true', () => {
    const result = validateTranslationFunction(
      makeGtCall(
        t.objectExpression([
          t.objectProperty(
            t.identifier('$requiresReview'),
            t.booleanLiteral(true)
          ),
        ])
      ),
      state
    );
    expect(result.errors).toHaveLength(0);
    expect(result.requiresReview).toBe(true);
  });

  it('accepts $requiresReview: false', () => {
    const result = validateTranslationFunction(
      makeGtCall(
        t.objectExpression([
          t.objectProperty(
            t.identifier('$requiresReview'),
            t.booleanLiteral(false)
          ),
        ])
      ),
      state
    );
    expect(result.errors).toHaveLength(0);
    expect(result.requiresReview).toBe(false);
  });

  it('rejects string "false"', () => {
    const result = validateTranslationFunction(
      makeGtCall(
        t.objectExpression([
          t.objectProperty(
            t.identifier('$requiresReview'),
            t.stringLiteral('false')
          ),
        ])
      ),
      state
    );
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.requiresReview).toBeUndefined();
  });

  it('rejects dynamic expressions', () => {
    const result = validateTranslationFunction(
      makeGtCall(
        t.objectExpression([
          t.objectProperty(
            t.identifier('$requiresReview'),
            t.identifier('someVar')
          ),
        ])
      ),
      state
    );
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.requiresReview).toBeUndefined();
  });

  it('is optional', () => {
    const result = validateTranslationFunction(
      makeGtCall(t.objectExpression([])),
      state
    );
    expect(result.errors).toHaveLength(0);
    expect(result.requiresReview).toBeUndefined();
  });
});

describe('requiresReview validation — <T> component args', () => {
  let state: TransformState;

  beforeEach(() => {
    state = createState();
  });

  it('accepts requiresReview: true (bare JSX attribute compiles to this)', () => {
    const result = validateTranslationComponentArgs(
      makeTComponentCall([
        t.objectProperty(
          t.identifier('requiresReview'),
          t.booleanLiteral(true)
        ),
      ]),
      GT_COMPONENT_TYPES.T,
      state
    );
    expect(result.errors).toHaveLength(0);
    expect(result.requiresReview).toBe(true);
  });

  it('accepts $requiresReview: false', () => {
    const result = validateTranslationComponentArgs(
      makeTComponentCall([
        t.objectProperty(
          t.identifier('$requiresReview'),
          t.booleanLiteral(false)
        ),
      ]),
      GT_COMPONENT_TYPES.T,
      state
    );
    expect(result.errors).toHaveLength(0);
    expect(result.requiresReview).toBe(false);
  });

  it('rejects string values', () => {
    const result = validateTranslationComponentArgs(
      makeTComponentCall([
        t.objectProperty(
          t.identifier('requiresReview'),
          t.stringLiteral('true')
        ),
      ]),
      GT_COMPONENT_TYPES.T,
      state
    );
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.join('\n')).toContain('boolean literal');
    expect(result.requiresReview).toBeUndefined();
  });

  it('rejects dynamic expressions', () => {
    const result = validateTranslationComponentArgs(
      makeTComponentCall([
        t.objectProperty(
          t.identifier('$requiresReview'),
          t.unaryExpression('!', t.identifier('flag'))
        ),
      ]),
      GT_COMPONENT_TYPES.T,
      state
    );
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.requiresReview).toBeUndefined();
  });
});
