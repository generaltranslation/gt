import { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import type { DataFormat } from 'generaltranslation/types';
import { InlineMetadata } from '../processTranslationCall/extractStringEntryMetadata.js';
import { ParsingConfig } from '../types.js';
import { ParsingOutput } from '../types.js';
import { handleDerivation } from './handleDerivation.js';
import { warnNonStringSync } from '../../../../../console/index.js';
import { nodeToStrings } from '../../parseString.js';
import generateModule from '@babel/generator';
import { indexVars } from 'generaltranslation/internal';
import { randomUUID } from 'node:crypto';
import { isValidIcu } from '../../../evaluateJsx.js';
import { warnInvalidIcuSync } from '../../../../../console/index.js';

// Handle CommonJS/ESM interop
const generate = generateModule.default || generateModule;

/**
 * Registers an expression with support for derive
 * Entry point for string derivation
 *
 * @param tPath - The path to the tag identifier
 * @param expr - The expression to parse
 * @param metadata - Extracted metadata (empty for tagged templates)
 * @param config - Parsing configuration
 * @param output - Parsing output collectors
 * @param enableRuntimeInterpolation - For template macros, enables runtime interpolation for non-derive calls
 */
export function deriveExpression({
  tPath,
  expr,
  metadata,
  config,
  output,
  index,
  enableRuntimeInterpolation = false,
  contextVariants,
}: {
  tPath: NodePath;
  expr: t.Expression;
  metadata: InlineMetadata;
  config: ParsingConfig;
  output: ParsingOutput;
  index?: number;
  enableRuntimeInterpolation?: boolean;
  contextVariants?: string[];
}) {
  // parse derivable expression
  const stringNode = handleDerivation({
    expr,
    tPath,
    file: config.file,
    parsingOptions: config.parsingOptions,
    errors: output.errors,
    warnings: output.warnings,
    runtimeInterpolationState: enableRuntimeInterpolation
      ? { index: 0 }
      : undefined,
    skipDeriveInvocation: config.autoderiveMethod === 'ENABLED',
  });

  // Nothing returned, push error
  if (!stringNode) {
    output.errors.push(
      warnNonStringSync(
        config.file,
        generate(expr).code,
        `${expr.loc?.start?.line}:${expr.loc?.start?.column}`
      )
    );
    return;
  }

  // validate ICU
  const strings = nodeToStrings(stringNode).map(indexVars);
  if (!config.ignoreInvalidIcu) {
    for (const string of strings) {
      const { isValid, error } = isValidIcu(string);
      if (!isValid) {
        output.warnings.add(
          warnInvalidIcuSync(
            config.file,
            string,
            error ?? 'Unknown error',
            `${expr.loc?.start?.line}:${expr.loc?.start?.column}`
          )
        );
        return;
      }
    }
  }

  const temporaryDeriveId = `derive-temp-id-${randomUUID()}`;
  const contexts = contextVariants ?? [metadata.context];
  for (const string of strings) {
    for (const context of contexts) {
      output.updates.push({
        dataFormat: (metadata.format || 'ICU') as DataFormat,
        source: string,
        metadata: {
          ...metadata,
          ...(context != null && { context }),
          // Add the index if an id and index is provided (for handling when registering an array of strings)
          ...(metadata.id &&
            index != null && { id: `${metadata.id}.${index}` }),
          staticId: temporaryDeriveId,
        },
      });
    }
  }
}
