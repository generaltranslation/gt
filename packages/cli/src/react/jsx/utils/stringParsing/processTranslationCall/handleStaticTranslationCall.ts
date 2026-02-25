import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { ParsingConfig } from '../types.js';
import { ParsingOutput } from '../types.js';
import { handleStaticExpression } from '../../parseDeclareStatic.js';
import { nodeToStrings } from '../../parseString.js';
import { indexVars } from 'generaltranslation/internal';
import { isValidIcu } from '../../../evaluateJsx.js';
import {
  warnInvalidIcuSync,
  warnNonStringSync,
} from '../../../../../console/index.js';
import generateModule from '@babel/generator';
import { randomUUID } from 'node:crypto';
import { extractStringEntryMetadata } from './extractStringEntryMetadata.js';

// Handle CommonJS/ESM interop
const generate = generateModule.default || generateModule;

/**
 * For the processTranslationCall function, this function handles the case where a string with declareStatic is used.
 * @param arg - The argument to parse
 * @param options - The options to parse
 * @param tPath - The path to the argument
 * @param config - The configuration to use
 * @param output - The output to use
 */
export function handleStaticTranslationCall({
  arg,
  options,
  tPath,
  config,
  output,
  index,
}: {
  arg: t.Expression;
  options?: t.Expression | t.ArgumentPlaceholder | t.SpreadElement;
  tPath: NodePath;
  config: ParsingConfig;
  output: ParsingOutput;
  index?: number;
}): void {
  // parse static expression
  const result = handleStaticExpression(
    arg,
    tPath,
    config.file,
    config.parsingOptions,
    output.errors
  );

  // Nothing returned, push error
  if (!result) {
    output.errors.push(
      warnNonStringSync(
        config.file,
        generate(arg).code,
        `${arg.loc?.start?.line}:${arg.loc?.start?.column}`
      )
    );
    return;
  }

  // validate ICU
  const strings = nodeToStrings(result).map(indexVars);
  if (!config.ignoreInvalidIcu) {
    for (const string of strings) {
      const { isValid, error } = isValidIcu(string);
      if (!isValid) {
        output.warnings.add(
          warnInvalidIcuSync(
            config.file,
            string,
            error ?? 'Unknown error',
            `${arg.loc?.start?.line}:${arg.loc?.start?.column}`
          )
        );
        return;
      }
    }
  }

  // get metadata and id from options
  const metadata = extractStringEntryMetadata({
    options,
    output,
    config,
    index,
  });

  const temporaryStaticId = `static-temp-id-${randomUUID()}`;
  for (const string of strings) {
    output.updates.push({
      dataFormat: 'ICU',
      source: string,
      metadata: { ...metadata, staticId: temporaryStaticId },
    });
  }
}
