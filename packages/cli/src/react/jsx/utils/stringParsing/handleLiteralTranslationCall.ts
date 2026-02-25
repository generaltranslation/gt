import * as t from '@babel/types';
import { ParsingConfig } from './types.js';
import { ParsingOutput } from './types.js';
import { isStaticExpression, isValidIcu } from '../../evaluateJsx.js';
import {
  warnInvalidIcuSync,
  warnInvalidMaxCharsSync,
} from '../../../../console/index.js';
import { warnNonStaticExpressionSync } from '../../../../console/index.js';
import { GT_ATTRIBUTES_WITH_SUGAR } from '../constants.js';
import generateModule from '@babel/generator';
import { mapAttributeName } from '../mapAttributeName.js';
import pathModule from 'node:path';
import { isNumberLiteral } from '../isNumberLiteral.js';

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
}: {
  arg: t.StringLiteral | t.TemplateLiteral;
  options?: t.Expression | t.ArgumentPlaceholder | t.SpreadElement;
  config: ParsingConfig;
  output: ParsingOutput;
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
          if (result.isStatic && result.value && !config.ignoreAdditionalData) {
            const mappedKey = mapAttributeName(attribute);
            if (attribute === '$maxChars') {
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
              metadata[mappedKey] = result.value;
            }
          }
        }
      }
    });
  }

  const relativeFilepath = pathModule.relative(process.cwd(), config.file);
  if (relativeFilepath) {
    if (!metadata.filePaths) {
      metadata.filePaths = [relativeFilepath];
    } else if (Array.isArray(metadata.filePaths)) {
      if (!metadata.filePaths.includes(relativeFilepath)) {
        metadata.filePaths.push(relativeFilepath);
      }
    }
  }

  output.updates.push({
    dataFormat: 'ICU',
    source,
    metadata,
  });
}
