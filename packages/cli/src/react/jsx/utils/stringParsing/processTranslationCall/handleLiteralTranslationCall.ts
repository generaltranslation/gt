import * as t from '@babel/types';
import { ParsingConfig } from '../types.js';
import { ParsingOutput } from '../types.js';
import { isValidIcu } from '../../../evaluateJsx.js';
import { warnInvalidIcuSync } from '../../../../../console/index.js';
import { InlineMetadata } from './extractStringEntryMetadata.js';

/**
 * For the processTranslationCall function, this function handles the case where a string literal or template literal is used.
 * @param arg - The argument to parse
 * @param options - The options to parse
 * @param tPath - The path to the argument
 * @param config - The configuration to use
 * @param output - The output to use
 * @param index - The index of the argument
 */
export function handleLiteralTranslationCall({
  arg,
  metadata,
  config,
  output,
  index,
}: {
  arg: t.StringLiteral | t.TemplateLiteral;
  metadata: InlineMetadata;
  config: ParsingConfig;
  output: ParsingOutput;
  index?: number;
}): void {
  // ignore dynamic content flag is triggered, check strings are valid ICU
  const source =
    arg.type === 'StringLiteral' ? arg.value : arg.quasis[0].value.raw;

  // Validate is ICU
  if (!config.ignoreInvalidIcu) {
    const { isValid, error } = isValidIcu(source);
    if (!isValid) {
      output.warnings.add(
        warnInvalidIcuSync(
          config.file,
          source,
          error ?? 'Unknown error',
          `${arg.loc?.start?.line}:${arg.loc?.start?.column}`
        )
      );
      return;
    }
  }

  output.updates.push({
    dataFormat: 'ICU',
    source,
    metadata: {
      ...metadata,
      // Add the index if an id and index is provided (for handling when registering an array of strings)
      ...(metadata.id && index != null && { id: `${metadata.id}.${index}` }),
    },
  });
}
