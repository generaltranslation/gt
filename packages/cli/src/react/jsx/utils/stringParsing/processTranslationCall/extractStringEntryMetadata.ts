import * as t from '@babel/types';
import { ParsingConfig } from '../types.js';
import { ParsingOutput } from '../types.js';
import { isStaticExpression } from '../../../evaluateJsx.js';
import { warnInvalidMaxCharsSync } from '../../../../../console/index.js';
import { warnNonStaticExpressionSync } from '../../../../../console/index.js';
import { GT_ATTRIBUTES_WITH_SUGAR } from '../../constants.js';
import generateModule from '@babel/generator';
import { mapAttributeName } from '../../mapAttributeName.js';
import pathModule from 'node:path';
import { isNumberLiteral } from '../../isNumberLiteral.js';
import {
  extractSurroundingLines,
  SurroundingLines,
} from '../../extractSurroundingLines.js';

// Handle CommonJS/ESM interop
const generate = generateModule.default || generateModule;

/**
 * Metadata record type
 */
export type InlineMetadata = {
  maxChars?: number;
  context?: string;
  id?: string;
  hash?: string;
  filePaths?: string[];
  surroundingLines?: SurroundingLines;
};

/**
 * Extracts inline metadata from a string entry
 * @param metadata - The metadata record to inject the data into
 * @param entry - The string entry to extract the metadata from
 * @param output - The output to use
 * @param config - The configuration to use
 * @returns The inline metadata
 *
 * @note - this function does not automatically append the index to the id, this must be done manually in the caller.
 *
 */
export function extractStringEntryMetadata({
  options,
  output,
  config,
  nodeLoc,
  surroundingLineCount = 5,
}: {
  options?: t.CallExpression['arguments'][number];
  output: ParsingOutput;
  config: ParsingConfig;
  nodeLoc?: { start?: { line: number } | null; end?: { line: number } | null } | null;
  surroundingLineCount?: number;
}): InlineMetadata {
  // extract filepath for entry
  const relativeFilepath = pathModule.relative(process.cwd(), config.file);

  // extract inline metadata
  const inlineMetadata = extractInlineMetadata({
    options,
    output,
    config,
  });

  // extract surrounding lines from source file
  let surroundingLines: SurroundingLines | undefined;
  if (nodeLoc?.start?.line && nodeLoc?.end?.line) {
    surroundingLines = extractSurroundingLines(
      config.file,
      nodeLoc.start.line,
      nodeLoc.end.line,
      surroundingLineCount
    );
  }

  return {
    ...inlineMetadata,
    filePaths: relativeFilepath ? [relativeFilepath] : undefined,
    ...(surroundingLines && { surroundingLines }),
  };
}

// ----- Helper Functions ----- //

/**
 * Extracts inline metadata specified e.g. gt('Hello', { $context: 'greeting' })
 * @param options - The options to extract the metadata from
 * @param output - The output to use
 * @param config - The configuration to use
 * @param index - The index of the string entry
 * @returns The inline metadata
 */
function extractInlineMetadata({
  options,
  output,
  config,
}: {
  options?: t.CallExpression['arguments'][number];
  output: ParsingOutput;
  config: ParsingConfig;
}): InlineMetadata {
  const metadata: Record<string, string | number | string[]> = {};
  if (options && options.type === 'ObjectExpression') {
    options.properties.forEach((prop) => {
      if (prop.type === 'ObjectProperty' && prop.key.type === 'Identifier') {
        const attribute = prop.key.name;
        if (
          GT_ATTRIBUTES_WITH_SUGAR.includes(
            attribute as (typeof GT_ATTRIBUTES_WITH_SUGAR)[number]
          ) &&
          t.isExpression(prop.value)
        ) {
          const result = isStaticExpression(prop.value);
          if (!result.isStatic) {
            output.errors.push(
              warnNonStaticExpressionSync(
                config.file,
                attribute,
                generate(prop.value).code,
                `${prop.loc?.start?.line}:${prop.loc?.start?.column}`
              )
            );
          }
          if (
            result.isStatic &&
            result.value != null &&
            !config.ignoreInlineMetadata
          ) {
            const mappedKey = mapAttributeName(attribute);
            if (mappedKey === 'maxChars') {
              // Handle maxChars attribute
              if (
                (typeof result.value === 'string' &&
                  (isNaN(Number(result.value)) ||
                    !isNumberLiteral(prop.value))) ||
                !Number.isInteger(Number(result.value))
              ) {
                output.errors.push(
                  warnInvalidMaxCharsSync(
                    config.file,
                    generate(prop).code,
                    `${prop.loc?.start?.line}:${prop.loc?.start?.column}`
                  )
                );
              } else if (typeof result.value === 'string') {
                // Add the maxChars value to the metadata
                metadata[mappedKey] = Math.abs(Number(result.value));
              }
            } else {
              // Add the $context or $id or other attributes value to the metadata
              // TODO: why are we including everything? arent we only interested in relevant inline metadata?
              metadata[mappedKey] = result.value;
            }
          }
        }
      }
    });
  }

  return metadata;
}
