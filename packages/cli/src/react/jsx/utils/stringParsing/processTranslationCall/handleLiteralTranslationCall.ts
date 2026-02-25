import * as t from '@babel/types';
import { ParsingConfig } from '../types.js';
import { ParsingOutput } from '../types.js';
import { isValidIcu } from '../../../evaluateJsx.js';
import { warnInvalidIcuSync } from '../../../../../console/index.js';
import { extractStringEntryMetadata } from './extractStringEntryMetadata.js';

/**
 * For the processTranslationCall function, this function handles the case where a string literal or template literal is used.
 * @param arg - The argument to parse
 * @param options - The options to parse
 * @param tPath - The path to the argument
 * @param config - The configuration to use
 * @param output - The output to use
 */
export function handleLiteralTranslationCall({
  arg,
  options,
  config,
  output,
  index,
}: {
  arg: t.StringLiteral | t.TemplateLiteral;
  options?: t.Expression | t.ArgumentPlaceholder | t.SpreadElement;
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

  // get metadata and id from options
  const metadata = extractStringEntryMetadata({
    options,
    output,
    config,
    index,
  });

  output.updates.push({
    dataFormat: 'ICU',
    source,
    metadata,
  });
}
