import * as t from '@babel/types';
import { NodePath } from '@babel/traverse';
import { TransformState } from '../../state/types';
import {
  validateMsgArrayFunction,
  validateTranslationFunction,
} from '../validation/validateTranslationFunction';
import { hashStringContent } from '../registration/registerStandaloneTranslation';
import {
  buildInlineArrayTranslationsFunction,
  buildInlineTranslationsFunction,
} from './inline-translations/buildInlineTranslationsFunction';

/**
 * Inject the inline translations callback into msg() invocations:
 * msg(message, options, (locale) => …).
 *
 * msg() does not take part in the injection counter, so it recomputes its
 * hashes here instead of reading them from the string collector. Validation
 * errors were already reported by the collection pass.
 *
 * Derive content (derive(), autoderive, derive $context) is not supported:
 * its hash is only known per resolved variant at runtime, so those calls are
 * left untouched and keep loading translations at runtime.
 */
export function injectMsgParameters(
  callExprPath: NodePath<t.CallExpression>,
  state: TransformState
): void {
  const table = state.settings.inlineTranslationsTable;
  const callExpr = callExprPath.node;
  if (!table || callExpr.arguments.length < 1) return;
  if (callExpr.arguments.length > 2) return;
  if (
    callExpr.arguments.length === 2 &&
    !t.isExpression(callExpr.arguments[1])
  ) {
    return;
  }

  const inline = t.isArrayExpression(callExpr.arguments[0])
    ? buildMsgArrayInline(callExprPath, state)
    : buildMsgInline(callExprPath, state);
  if (!inline) return;

  if (callExpr.arguments.length === 1) {
    callExpr.arguments.push(t.identifier('undefined'));
  }
  callExpr.arguments.push(inline);
}

function buildMsgInline(
  callExprPath: NodePath<t.CallExpression>,
  state: TransformState
): t.ArrowFunctionExpression | undefined {
  const params = validateTranslationFunction(callExprPath, state);
  if (
    params.errors.length > 0 ||
    params.content === undefined ||
    params.hasDeriveContext
  ) {
    return undefined;
  }
  const hash =
    params.hash ??
    hashStringContent({
      content: params.content,
      context: params.context,
      maxChars: params.maxChars,
      requiresReview: params.requiresReview,
      format: params.format,
    });
  return buildInlineTranslationsFunction(
    state.settings.inlineTranslationsTable!,
    hash
  );
}

function buildMsgArrayInline(
  callExprPath: NodePath<t.CallExpression>,
  state: TransformState
): t.ArrowFunctionExpression | undefined {
  const params = validateMsgArrayFunction(callExprPath, state);
  // A user-supplied $_hash would be shared by every element, so skip it
  if (
    params.errors.length > 0 ||
    params.contents === undefined ||
    params.hasDeriveContext ||
    params.hash !== undefined
  ) {
    return undefined;
  }
  const hashes = params.contents.map((content) =>
    hashStringContent({
      content,
      context: params.context,
      maxChars: params.maxChars,
      requiresReview: params.requiresReview,
      format: params.format,
    })
  );
  return buildInlineArrayTranslationsFunction(
    state.settings.inlineTranslationsTable!,
    hashes
  );
}
