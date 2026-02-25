import * as t from '@babel/types';
import { ParsingConfig } from '../types.js';
import { ParsingOutput } from '../types.js';
import { isStaticExpression, isValidIcu } from '../../../evaluateJsx.js';
import {
  warnInvalidIcuSync,
  warnInvalidMaxCharsSync,
} from '../../../../../console/index.js';
import { warnNonStaticExpressionSync } from '../../../../../console/index.js';
import { GT_ATTRIBUTES_WITH_SUGAR } from '../../constants.js';
import generateModule from '@babel/generator';
import { mapAttributeName } from '../../mapAttributeName.js';
import pathModule from 'node:path';
import { isNumberLiteral } from '../../isNumberLiteral.js';
import { extractStringEntryMetadata } from './extractStringEntryMetadata.js';

// Handle CommonJS/ESM interop
const generate = generateModule.default || generateModule;

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
