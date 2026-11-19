import * as t from '@babel/types';
import { TranslationJsx } from '../../state/StringCollector';
import {
  GT_OTHER_FUNCTIONS,
  TRANSLATION_OPTION_KEYS,
} from '../../utils/constants/gt/constants';

/**
 * Build a single `await Promise.all([...])` expression statement containing
 * runtime translate calls for all extracted JSX content.
 */
export function buildRuntimeTranslateCalls(
  jsx: TranslationJsx[]
): t.ExpressionStatement {
  const calls = jsx.map(buildJsxCall);

  // Wrap in await Promise.all([...])
  const promiseAll = t.callExpression(
    t.memberExpression(t.identifier('Promise'), t.identifier('all')),
    [t.arrayExpression(calls)]
  );

  return t.expressionStatement(t.awaitExpression(promiseAll));
}

/**
 * Build a single GtInternalRuntimeTranslateJsx(children, options) call
 */
function buildJsxCall(entry: TranslationJsx): t.CallExpression {
  const properties: t.ObjectProperty[] = [];

  if (entry.context !== undefined) {
    properties.push(
      t.objectProperty(
        t.stringLiteral(TRANSLATION_OPTION_KEYS.$context),
        t.stringLiteral(entry.context)
      )
    );
  }

  if (entry.id !== undefined) {
    properties.push(
      t.objectProperty(
        t.stringLiteral(TRANSLATION_OPTION_KEYS.$id),
        t.stringLiteral(entry.id)
      )
    );
  }

  // requiresReview is part of the review-aware hash; without it the runtime
  // recomputes a non-review hash and misses the cached entry
  if (entry.requiresReview === true) {
    properties.push(
      t.objectProperty(
        t.stringLiteral(TRANSLATION_OPTION_KEYS.$requiresReview),
        t.booleanLiteral(true)
      )
    );
  }

  // Serialize children to AST — handles arrays, objects, strings, numbers, null
  const childrenNode =
    entry.children != null ? t.valueToNode(entry.children) : t.nullLiteral();

  return t.callExpression(
    t.identifier(GT_OTHER_FUNCTIONS.GtInternalRuntimeTranslateJsx),
    [childrenNode, t.objectExpression(properties)]
  );
}
