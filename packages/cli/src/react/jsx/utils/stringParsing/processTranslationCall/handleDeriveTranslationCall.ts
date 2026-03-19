import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { ParsingConfig } from '../types.js';
import { ParsingOutput } from '../types.js';
import { deriveExpression } from '../derivation/index.js';
import { InlineMetadata } from './extractStringEntryMetadata.js';

/**
 * For the processTranslationCall function, this function handles the case where a string with derive is used.
 * @param arg - The argument to parse
 * @param metadata - The metadata to use
 * @param tPath - The path to the argument
 * @param config - The configuration to use
 * @param output - The output to use
 * @param index - Current index in array of strings being extracted
 */
export function handleDeriveTranslationCall({
  arg,
  metadata,
  tPath,
  config,
  output,
  index,
}: {
  arg: t.Expression;
  metadata: InlineMetadata;
  tPath: NodePath;
  config: ParsingConfig;
  output: ParsingOutput;
  index?: number;
}): void {
  deriveExpression({
    tPath,
    expr: arg,
    metadata,
    config,
    output,
    index,
  });
}
