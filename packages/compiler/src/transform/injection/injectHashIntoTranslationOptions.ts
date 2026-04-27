import * as t from '@babel/types';
import { USEGT_CALLBACK_OPTIONS } from '../../utils/constants/gt/constants';

/**
 * Inject $_hash into the second options argument for string translation calls.
 */
export function injectHashIntoTranslationOptions(
  callExpr: t.CallExpression,
  hash: string
): void {
  const newEntry = t.objectProperty(
    t.stringLiteral(USEGT_CALLBACK_OPTIONS.$_hash),
    t.stringLiteral(hash)
  );

  if (callExpr.arguments.length === 1) {
    callExpr.arguments.push(t.objectExpression([newEntry]));
    return;
  }

  if (callExpr.arguments.length !== 2) {
    return;
  }

  const optionsArg = callExpr.arguments[1];
  if (t.isObjectExpression(optionsArg)) {
    optionsArg.properties.push(newEntry);
  } else if (t.isExpression(optionsArg)) {
    callExpr.arguments[1] = t.objectExpression([
      t.spreadElement(optionsArg),
      newEntry,
    ]);
  } else if (t.isArgumentPlaceholder(optionsArg)) {
    callExpr.arguments[1] = t.objectExpression([newEntry]);
  }
}
