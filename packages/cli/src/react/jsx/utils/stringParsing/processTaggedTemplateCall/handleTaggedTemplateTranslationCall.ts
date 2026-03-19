import * as t from '@babel/types';
import { ParsingConfig, ParsingOutput } from '../types.js';
import { InlineMetadata } from '../processTranslationCall/extractStringEntryMetadata.js';
import { NodePath } from '@babel/traverse';
import { deriveExpression } from '../derivation/index.js';

/**
 * Extracts a translatable message from a TaggedTemplateExpression.
 *
 * Follows the same extraction pattern as `extractInterpolatableValues` in
 * `packages/react/src/i18n-context/functions/translation/t.ts`:
 * - Iterates through quasis and expressions interleaved
 * - Creates numeric placeholders ({0}, {1}, etc.) for each expression
 * - Joins all parts into the final source string
 *
 * @param tPath - The path to the tag identifier
 * @param quasi - The TemplateLiteral from the TaggedTemplateExpression
 * @param metadata - Extracted metadata (empty for tagged templates)
 * @param config - Parsing configuration
 * @param output - Parsing output collectors
 */
export function handleTaggedTemplateTranslationCall({
  tPath,
  quasi,
  metadata,
  config,
  output,
}: {
  tPath: NodePath;
  quasi: t.TemplateLiteral;
  metadata: InlineMetadata;
  config: ParsingConfig;
  output: ParsingOutput;
}): void {
  deriveExpression({
    tPath,
    expr: quasi,
    metadata,
    config,
    output,
    enableRuntimeInterpolation: true,
  });
}
