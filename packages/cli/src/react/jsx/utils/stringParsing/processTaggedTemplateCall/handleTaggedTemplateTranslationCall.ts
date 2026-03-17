import * as t from '@babel/types';
import { ParsingConfig, ParsingOutput } from '../types.js';
import { isValidIcu } from '../../../evaluateJsx.js';
import { warnInvalidIcuSync } from '../../../../../console/index.js';
import { InlineMetadata } from '../processTranslationCall/extractStringEntryMetadata.js';

/**
 * Extracts a translatable message from a TaggedTemplateExpression.
 *
 * Follows the same extraction pattern as `extractInterpolatableValues` in
 * `packages/react/src/i18n-context/functions/translation/t.ts`:
 * - Iterates through quasis and expressions interleaved
 * - Creates numeric placeholders ({0}, {1}, etc.) for each expression
 * - Joins all parts into the final source string
 *
 * @param quasi - The TemplateLiteral from the TaggedTemplateExpression
 * @param metadata - Extracted metadata (empty for tagged templates)
 * @param config - Parsing configuration
 * @param output - Parsing output collectors
 */
export function handleTaggedTemplateTranslationCall({
  quasi,
  metadata,
  config,
  output,
}: {
  quasi: t.TemplateLiteral;
  metadata: InlineMetadata;
  config: ParsingConfig;
  output: ParsingOutput;
}): void {
  const parts: string[] = [];
  let varIndex = 0;

  for (let i = 0; i < quasi.quasis.length; i++) {
    parts.push(quasi.quasis[i].value.cooked ?? quasi.quasis[i].value.raw);

    if (i < quasi.expressions.length) {
      const key = varIndex.toString();
      parts.push(`{${key}}`);
      varIndex++;
    }
  }

  const source = parts.join('');

  // Validate ICU format
  if (!config.ignoreInvalidIcu) {
    const { isValid, error } = isValidIcu(source);
    if (!isValid) {
      output.warnings.add(
        warnInvalidIcuSync(
          config.file,
          source,
          error ?? 'Unknown error',
          `${quasi.loc?.start?.line}:${quasi.loc?.start?.column}`
        )
      );
      return;
    }
  }

  output.updates.push({
    dataFormat: 'ICU',
    source,
    metadata,
  });
}
