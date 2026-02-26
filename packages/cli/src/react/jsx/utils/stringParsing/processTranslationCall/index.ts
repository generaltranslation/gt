import { NodePath } from '@babel/traverse';
import { ParsingConfig } from '../types.js';
import { ParsingOutput } from '../types.js';
import { routeTranslationCall } from './routeTranslationCall.js';
import { extractStringEntryMetadata } from './extractStringEntryMetadata.js';

/**
 * Processes a single translation function call (e.g., t('hello world', { id: 'greeting' })).
 * Extracts the translatable string content and metadata, then adds it to the updates array.
 *
 * Handles:
 * - String literals: t('hello')
 * - Template literals without expressions: t(`hello`)
 * - Metadata extraction from options object
 * - Error reporting for non-static expressions and template literals with expressions
 *
 * @param tPath - The path to the translation call
 * @param config - The configuration to use
 * @param output - The output to use
 */
export function processTranslationCall(
  tPath: NodePath,
  config: ParsingConfig,
  output: ParsingOutput
): void {
  if (
    tPath.parent.type !== 'CallExpression' ||
    tPath.parent.arguments.length === 0
  ) {
    return;
  }

  // Get arg and options
  const arg = tPath.parent.arguments[0];
  const options = tPath.parent.arguments.at(1);

  // get metadata and id from options
  const metadata = extractStringEntryMetadata({
    options,
    output,
    config,
  });

  // Route tx call to appropriate handler
  routeTranslationCall({
    tPath,
    config,
    output,
    arg,
    metadata,
  });
}
