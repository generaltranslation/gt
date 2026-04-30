import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { ParsingConfig, ParsingOutput } from '../types.js';
import { handleTaggedTemplateTranslationCall } from './handleTaggedTemplateTranslationCall.js';
import { extractStringEntryMetadata } from '../processTranslationCall/extractStringEntryMetadata.js';
import { SURROUNDING_LINE_COUNT } from '../../../../../utils/constants.js';

/**
 * Processes a tagged template expression (e.g., t`hello ${name}`).
 * Extracts the translatable string with numeric placeholders for expressions.
 *
 * Tagged templates don't support an options argument, but still carry
 * source metadata for dashboard grouping and source context.
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

  const metadata = extractStringEntryMetadata({
    output,
    config,
    nodeLoc: tPath.parent.loc,
    surroundingLineCount: SURROUNDING_LINE_COUNT,
  });

  handleTaggedTemplateTranslationCall({
    tPath,
    quasi: tPath.parent.quasi,
    metadata,
    config,
    output,
  });
}
