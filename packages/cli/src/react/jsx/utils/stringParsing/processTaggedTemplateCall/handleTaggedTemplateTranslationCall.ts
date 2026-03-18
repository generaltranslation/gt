import * as t from '@babel/types';
import { ParsingConfig, ParsingOutput } from '../types.js';
import { isValidIcu } from '../../../evaluateJsx.js';
import {
  warnInvalidIcuSync,
  warnNonStringSync,
} from '../../../../../console/index.js';
import { InlineMetadata } from '../processTranslationCall/extractStringEntryMetadata.js';
import { NodePath } from '@babel/traverse';
import { handleDeriveExpression } from '../derivation/parseDerive.js';
import { randomUUID } from 'node:crypto';
import { nodeToStrings } from '../../parseString.js';
import generateModule from '@babel/generator';
import { indexVars } from 'generaltranslation/internal';

// Handle CommonJS/ESM interop
const generate = generateModule.default || generateModule;

/**
 * Extracts a translatable message from a TaggedTemplateExpression.
 *
 * Follows the same extraction pattern as `extractInterpolatableValues` in
 * `packages/react/src/i18n-context/functions/translation/t.ts`:
 * - Iterates through quasis and expressions interleaved
 * - Creates numeric placeholders ({0}, {1}, etc.) for each expression
 * - Joins all parts into the final source string
 *
 * @param tPath - The path to the tag identifier
 * @param quasi - The TemplateLiteral from the TaggedTemplateExpression
 * @param metadata - Extracted metadata (empty for tagged templates)
 * @param config - Parsing configuration
 * @param output - Parsing output collectors
 */
export function handleTaggedTemplateTranslationCall({
  tPath,
  quasi,
  metadata,
  config,
  output,
}: {
  tPath: NodePath;
  quasi: t.TemplateLiteral;
  metadata: InlineMetadata;
  config: ParsingConfig;
  output: ParsingOutput;
}): void {
  // parse derivable expression
  const stringNode = handleDeriveExpression({
    expr: quasi,
    tPath,
    file: config.file,
    parsingOptions: config.parsingOptions,
    errors: output.errors,
    enableRuntimeInterpolation: true,
  });

  // Nothing returned, push error
  if (!stringNode) {
    output.errors.push(
      warnNonStringSync(
        config.file,
        generate(quasi).code,
        `${quasi.loc?.start?.line}:${quasi.loc?.start?.column}`
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
            `${quasi.loc?.start?.line}:${quasi.loc?.start?.column}`
          )
        );
        return;
      }
    }
  }

  const temporaryDeriveId = `derive-temp-id-${randomUUID()}`;
  for (const string of strings) {
    output.updates.push({
      dataFormat: 'ICU',
      source: string,
      metadata: {
        ...metadata,
        staticId: temporaryDeriveId,
      },
    });
  }
}
