import * as t from '@babel/types';
import type { LocaleTwinCollector } from '../state/LocaleTwinCollector';
import { USEGT_CALLBACK_OPTIONS } from '../../utils/constants/gt/constants';
import { getObjectPropertyFromObjectExpression } from '../../utils/parsing/getObjectPropertyFromObjectExpression';
import { injectHashIntoTranslationOptions } from '../../transform/injection/injectHashIntoTranslationOptions';

/**
 * Injects `$_hash` into every attributed `msg()` call that does not carry one,
 * so the encoded message can be looked up by hash once its source text is
 * removed from client code.
 */
export function injectMsgHashes(collector: LocaleTwinCollector): void {
  for (const entry of collector.getEntries()) {
    if (entry.api !== 'msg' || hasHashOption(entry.node)) continue;
    injectHashIntoTranslationOptions(entry.node, entry.hash);
  }
}

function hasHashOption(callExpr: t.CallExpression): boolean {
  const options = callExpr.arguments[1];
  return (
    t.isObjectExpression(options) &&
    getObjectPropertyFromObjectExpression(
      options,
      USEGT_CALLBACK_OPTIONS.$_hash
    ) !== undefined
  );
}
