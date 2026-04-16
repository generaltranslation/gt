import * as t from '@babel/types';
import {
  TranslationContent,
  TranslationJsx,
} from '../../state/StringCollector';
import {
  GT_OTHER_FUNCTIONS,
  USEGT_CALLBACK_OPTIONS,
} from '../../utils/constants/gt/constants';

/**
 * Build a single `await Promise.all([...])` expression statement containing
 * runtime translate calls for all extracted strings and JSX content.
 */
export function buildRuntimeTranslateCalls({
  strings,
  jsx,
}: {
  strings: TranslationContent[];
  jsx: TranslationJsx[];
}): t.ExpressionStatement {
  const calls: t.CallExpression[] = [];

  // Build GtInternalRuntimeTranslateString calls
  for (const entry of strings) {
    calls.push(buildStringCall(entry));
  }

  // Build GtInternalRuntimeTranslateJsx calls
  for (const entry of jsx) {
    calls.push(buildJsxCall(entry));
  }

  // Wrap in await Promise.all([...])
  const promiseAll = t.callExpression(
    t.memberExpression(t.identifier('Promise'), t.identifier('all')),
    [t.arrayExpression(calls)]
  );

  return t.expressionStatement(t.awaitExpression(promiseAll));
}

/**
 * Build a single GtInternalRuntimeTranslateString(message, options) call
 */
function buildStringCall(entry: TranslationContent): t.CallExpression {
  const properties: t.ObjectProperty[] = [];

  if (entry.context !== undefined) {
    properties.push(
      t.objectProperty(
        t.stringLiteral(USEGT_CALLBACK_OPTIONS.$context),
        t.stringLiteral(entry.context)
      )
    );
  }

  if (entry.hash !== undefined) {
    properties.push(
      t.objectProperty(
        t.stringLiteral(USEGT_CALLBACK_OPTIONS.$_hash),
        t.stringLiteral(entry.hash)
      )
    );
  }

  if (entry.id !== undefined) {
    properties.push(
      t.objectProperty(
        t.stringLiteral(USEGT_CALLBACK_OPTIONS.$id),
        t.stringLiteral(entry.id)
      )
    );
  }

  if (entry.maxChars !== undefined) {
    properties.push(
      t.objectProperty(
        t.stringLiteral(USEGT_CALLBACK_OPTIONS.$maxChars),
        t.numericLiteral(entry.maxChars)
      )
    );
  }

  if (entry.format !== undefined) {
    properties.push(
      t.objectProperty(
        t.stringLiteral(USEGT_CALLBACK_OPTIONS.$format),
        t.stringLiteral(entry.format)
      )
    );
  }

  return t.callExpression(
    t.identifier(GT_OTHER_FUNCTIONS.GtInternalRuntimeTranslateString),
    [t.stringLiteral(entry.message), t.objectExpression(properties)]
  );
}

/**
 * Build a single GtInternalRuntimeTranslateJsx(children, options) call
 */
function buildJsxCall(entry: TranslationJsx): t.CallExpression {
  const properties: t.ObjectProperty[] = [];

  if (entry.context !== undefined) {
    properties.push(
      t.objectProperty(
        t.stringLiteral(USEGT_CALLBACK_OPTIONS.$context),
        t.stringLiteral(entry.context)
      )
    );
  }

  if (entry.id !== undefined) {
    properties.push(
      t.objectProperty(
        t.stringLiteral(USEGT_CALLBACK_OPTIONS.$id),
        t.stringLiteral(entry.id)
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
