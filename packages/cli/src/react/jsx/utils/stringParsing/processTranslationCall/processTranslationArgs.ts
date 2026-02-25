import { isStaticExpression } from '../../../evaluateJsx.js';
import { handleStaticTranslationCall } from './handleStaticTranslationCall.js';
import { handleLiteralTranslationCall } from './handleLiteralTranslationCall.js';
import { handleInvalidTranslationCall } from './handleInvalidTranslationCall.js';
import * as t from '@babel/types';
import { ParsingConfig } from '../types.js';
import { ParsingOutput } from '../types.js';
import { NodePath } from '@babel/traverse';

/**
 * Helper function for processTranslationCall
 * Given arg and options, validate + extract strings
 */
export function processTranslationArgs({
  tPath,
  config,
  output,
  arg,
  options,
  index,
}: {
  tPath: NodePath;
  config: ParsingConfig;
  output: ParsingOutput;
  arg: t.CallExpression['arguments'][number];
  options: t.CallExpression['arguments'][number] | undefined;
  index?: number;
}): void {
  if (t.isArrayExpression(arg) && index == null) {
    // handle array translation call
    for (let i = 0; i < arg.elements.length; i++) {
      const element = arg.elements[i];
      if (element == null) continue;
      processTranslationArgs({
        tPath,
        config,
        output,
        arg: element,
        options,
        index: i,
      });
    }
  } else if (
    !config.ignoreDynamicContent &&
    t.isExpression(arg) &&
    !isStaticExpression(arg).isStatic
  ) {
    // handle static translation call
    handleStaticTranslationCall({
      arg,
      options,
      tPath,
      config,
      output,
      index,
    });
  } else if (
    arg.type === 'StringLiteral' ||
    (t.isTemplateLiteral(arg) && arg.expressions.length === 0)
  ) {
    // Handle string and template literals
    handleLiteralTranslationCall({
      arg,
      options,
      config,
      output,
      index,
    });
  } else {
    // error on invalid translation call
    handleInvalidTranslationCall({
      arg,
      config,
      output,
    });
  }
}
