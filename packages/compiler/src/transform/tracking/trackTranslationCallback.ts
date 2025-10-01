import * as t from '@babel/types';
import { TransformState } from '../../state/types';
import { extractIdAndContextFromOptions } from '../transform';
import { hashExpressionString } from '../../utils/hash/hashExpressionString';
import { extractStringFromExpr } from '../transform';
import { createTranslationContent } from '../transform';
import { createTranslationHash } from '../transform';
import { getStringLiteralFromExpression } from '../../utils/jsx/getStringLiteralFromExpression';
import { getObjectPropertyFromObjectExpression } from '../../utils/jsx/getObjectPropertyFromObjectExpression';
import { USEGT_CALLBACK_OPTION_NAMES } from '../../utils/constants/gt/constants';

/**
 * Track gt() function invocations
 * - Adds the translation content to the string collector
 * - Assumes that the first argument is a valid string literal
 * - Assumes that the second argument is a valid options object
 */
export function trackTranslationCallback(
  callExpr: t.CallExpression,
  args: { content?: string; context?: string; id?: string },
  identifier: number,
  state: TransformState
): void {
  // Get the arguments
  const { content, context, id } = args;

  // Calculate hash for the call expression
  const hash = hashExpressionString(content, { id, context });

  // Add the translation content to the string collector
  state.stringCollector.setTranslationContent(identifier, {
    message: content,
    hash,
    id,
    context,
  });

  // Store the t() function call
  const counterId = state.stringCollector.incrementCounter();
  state.stringCollector.initializeAggregator(counterId);

  // Add the message to the string collector for the gt() function
  state.stringCollector.setTranslationHash(
    counterId,
    createTranslationHash(hash)
  );
}

// if (extractStringFromExpr(stringArg)) {
//   const message = extractStringFromExpr(stringArg);
//   if (hash && message) {
//     // Construct the translation content object
//     const translationContent = createTranslationContent(
//       message,
//       hash,
//       id,
//       context
//     );

//     // Add the translation content to the string collector
//     state.stringCollector.setTranslationContent(
//       identifier,
//       translationContent
//     );

//     // Store the t() function call
//     const counterId = state.stringCollector.incrementCounter();
//     state.stringCollector.initializeAggregator(counterId);

//     // Add the message to the string collector for the gt() function
//     state.stringCollector.setTranslationHash(
//       counterId,
//       createTranslationHash(hash)
//     );
//   }
// }
// }

/**
 * Assumes that the second argument is a valid options object
 * @param secondArg
 * @returns
 */
function getContextAndIdFromSecondArg(
  secondArg: t.Expression | t.SpreadElement | t.ArgumentPlaceholder | undefined
): { context: string | undefined; id: string | undefined } {
  const result = { context: undefined, id: undefined };
  if (!secondArg || !t.isObjectExpression(secondArg)) {
    return result;
  }

  if (t.isObjectExpression(secondArg)) {
    Object.keys(USEGT_CALLBACK_OPTION_NAMES).forEach((field) => {
      const property = getObjectPropertyFromObjectExpression(secondArg, field);
      if (!property) return;

      result[USEGT_CALLBACK_OPTION_NAMES[field]] = property as t.ObjectProperty;
    });
  }
}
