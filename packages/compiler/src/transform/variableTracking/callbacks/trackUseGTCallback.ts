import * as t from '@babel/types';
import { TransformState } from '../../../state/types';
import { extractIdAndContextFromOptions } from '../../transform';
import { hashExpressionString } from '../../../utils/hash/hashExpressionString';
import { extractStringFromExpr } from '../../transform';
import { createTranslationContent } from '../../transform';
import { createTranslationHash } from '../../transform';
import { getStringLiteralFromExpression } from '../../../utils/jsx/getStringLiteralFromExpression';
import { getObjectPropertyFromObjectExpression } from '../../../utils/jsx/getObjectPropertyFromObjectExpression';
import { USEGT_CALLBACK_OPTION_NAMES } from '../../../utils/constants/constants';
import { hashSource } from 'generaltranslation/id';

/**
 * Track gt() function invocations
 * - Adds the translation content to the string collector
 */
export function trackUseGTCallback(
  identifier: number,
  state: TransformState,
  content: string,
  context?: string,
  id?: string
): void {
  // Calculate hash for the call expression
  const hash = hashSource({ source: content, id, context, dataFormat: 'ICU' });

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
