import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { ParsingConfig, ParsingOutput } from '../types.js';
import { handleTaggedTemplateTranslationCall } from './handleTaggedTemplateTranslationCall.js';

/**
 * Processes a tagged template expression (e.g., t`hello ${name}`).
 * Extracts the translatable string with numeric placeholders for expressions.
 *
 * Tagged templates don't support an options argument, so metadata is empty.
 *
 * @param tPath - The path to the tag identifier
 * @param config - Parsing configuration
 * @param output - Parsing output collectors
 */
export function processTaggedTemplateCall(
  tPath: NodePath,
  config: ParsingConfig,
  output: ParsingOutput
): void {
  if (
    !t.isTaggedTemplateExpression(tPath.parent) ||
    tPath.parent.tag !== tPath.node
  ) {
    return;
  }

  handleTaggedTemplateTranslationCall({
    tPath,
    quasi: tPath.parent.quasi,
    metadata: {},
    config,
    output,
  });
}
