import * as t from '@babel/types';
import { ParsingConfig, ParsingOutput } from '../types.js';
import {
  warnNonStringSync,
  warnTemplateLiteralSync,
} from '../../../../../console/index.js';
import generateModule from '@babel/generator';

// Handle CommonJS/ESM interop
const generate = generateModule.default || generateModule;

/**
 * For the processTranslationCall function, this function handles the case where a other translation call is used.
 * Error is pushed if the other translation call is used.
 * @param arg - The argument to parse
 * @param config - The configuration to use
 * @param output - The output to use
 */
export function handleInvalidTranslationCall({
  arg,
  config,
  output,
}: {
  arg: t.ArgumentPlaceholder | t.SpreadElement | t.Expression;
  config: ParsingConfig;
  output: ParsingOutput;
}): void {
  if (config.ignoreDynamicContent) return;

  if (t.isTemplateLiteral(arg)) {
    // Specific error for template literals
    output.errors.push(
      warnTemplateLiteralSync(
        config.file,
        generate(arg).code,
        `${arg.loc?.start?.line}:${arg.loc?.start?.column}`
      )
    );
  } else {
    // Generic error
    output.errors.push(
      warnNonStringSync(
        config.file,
        generate(arg).code,
        `${arg.loc?.start?.line}:${arg.loc?.start?.column}`
      )
    );
  }
}
