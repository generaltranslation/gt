import { isStaticExpression } from '../../../evaluateJsx.js';
import { handleDeriveTranslationCall } from './handleDeriveTranslationCall.js';
import { handleLiteralTranslationCall } from './handleLiteralTranslationCall.js';
import { handleInvalidTranslationCall } from './handleInvalidTranslationCall.js';
import * as t from '@babel/types';
import { ParsingConfig } from '../types.js';
import { ParsingOutput } from '../types.js';
import { NodePath } from '@babel/traverse';
import { InlineMetadata } from './extractStringEntryMetadata.js';

/**
 * Helper function for processTranslationCall
 * Given arg and options, maps to appropriate translation call handler
 * @param tPath - The path to the translation call
 * @param config - The configuration to use
 * @param output - The output to use
 * @param arg - The argument to parse
 * @param metadata - The metadata to use
 * @param index - The index of the argument
 * @returns void
 */
export function routeTranslationCall({
  tPath,
  config,
  output,
  arg,
  metadata,
  index,
  contextVariants,
}: {
  tPath: NodePath;
  config: ParsingConfig;
  output: ParsingOutput;
  arg: t.CallExpression['arguments'][number];
  metadata: InlineMetadata;
  index?: number;
  contextVariants?: string[];
}): void {
  if (
    t.isArrayExpression(arg) &&
    index == null &&
    !config.ignoreInlineListContent
  ) {
    // handle array translation call
    for (let i = 0; i < arg.elements.length; i++) {
      const element = arg.elements[i];
      if (element == null) continue;
      routeTranslationCall({
        tPath,
        config,
        output,
        arg: element,
        index: i,
        metadata,
        contextVariants,
      });
    }
  } else if (
    !config.ignoreDynamicContent &&
    t.isExpression(arg) &&
    !isStaticExpression(arg).isStatic
  ) {
    // handle derive translation call
    handleDeriveTranslationCall({
      arg,
      metadata,
      tPath,
      config,
      output,
      index,
      contextVariants,
    });
  } else if (
    arg.type === 'StringLiteral' ||
    (t.isTemplateLiteral(arg) && arg.expressions.length === 0)
  ) {
    // Handle string and template literals
    handleLiteralTranslationCall({
      arg,
      metadata,
      config,
      output,
      index,
      contextVariants,
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
