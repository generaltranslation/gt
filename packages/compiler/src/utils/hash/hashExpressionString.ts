import { hashSource } from 'generaltranslation/id';
import {
  extractIdAndContextFromOptions,
  extractStringFromExpr,
} from '../../transform/transform';
import * as t from '@babel/types';

/**
 * Calculate hash for a call expression
 */
export function hashExpressionString(
  stringArg: t.Expression | t.SpreadElement,
  options: t.Expression | t.SpreadElement | undefined
): { hash?: string; jsonString?: string } {
  // Extract the string content
  const stringContent = extractStringFromExpr(stringArg);
  if (!stringContent) {
    return {};
  }

  // Extract the options content
  const { id, context } = extractIdAndContextFromOptions(options);

  // Construct the sanitized data object matching generaltranslation/id format
  const sanitizedData = {
    source: [stringContent], // JsxChildren expects array of strings/components
    id,
    context,
    dataFormat: 'ICU' as const,
  };

  // Calculate hash using hashSource from generaltranslation/id
  const hash = hashSource(sanitizedData);
  const jsonString = JSON.stringify(sanitizedData);

  return { hash, jsonString };
}

/* =============================== */
/* Helpers */
/* =============================== */
