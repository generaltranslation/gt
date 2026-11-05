import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { warnNonLiteralMsgCallSync } from '../../../../../console/index.js';
import { extractStringEntryMetadata } from '../processTranslationCall/extractStringEntryMetadata.js';
import type { ParsingConfig, ParsingOutput } from '../types.js';
import { formatLocation } from './diagnostics.js';

/**
 * Extracts msg('text'), whose message tree is the text itself. Returns false
 * for msg({ ...options }), which configures a tag instead.
 */
export function processMsgCall(
  call: NodePath<t.CallExpression>,
  config: ParsingConfig,
  output: ParsingOutput
): boolean {
  const { arguments: args } = call.node;
  const [arg] = args;
  if (args.length === 1 && t.isObjectExpression(arg)) return false;
  const text =
    args.length !== 1
      ? undefined
      : t.isStringLiteral(arg)
        ? arg.value
        : t.isTemplateLiteral(arg) && arg.expressions.length === 0
          ? arg.quasis[0].value.cooked
          : undefined;
  if (text == null) {
    output.warnings.add(
      warnNonLiteralMsgCallSync(config.file, formatLocation(call.node))
    );
    return true;
  }
  if (text === '') return true;
  output.updates.push({
    dataFormat: 'ICU_TREE',
    source: [text],
    metadata: extractStringEntryMetadata({
      output,
      config,
      nodeLoc: call.node.loc,
    }),
  });
  return true;
}
