import type { NodePath } from '@babel/traverse';
import type * as t from '@babel/types';
import { buildMessageTree } from '@generaltranslation/icu/internal';
import { formatDiagnosticErrorDetails } from 'generaltranslation/diagnostics';
import { randomUUID } from 'node:crypto';
import { warnNonStaticMessageTreeSync } from '../../../../../console/index.js';
import { extractStringEntryMetadata } from '../processTranslationCall/extractStringEntryMetadata.js';
import type { ParsingConfig, ParsingOutput } from '../types.js';
import { NonStaticMessageError, formatLocation } from './diagnostics.js';
import { parseMessageOptions } from './parseMessageOptions.js';
import { templateVariants } from './templateVariants.js';
import type { TagOptions, TreeContext } from './types.js';

export function processMessage(
  tagged: NodePath<t.TaggedTemplateExpression>,
  options: TagOptions | undefined,
  config: ParsingConfig,
  output: ParsingOutput
): void {
  const context: TreeContext = {
    config,
    output,
    usesDerive: false,
    resolvingParts: new Set(),
  };
  try {
    const hashMetadata = parseMessageOptions(options, tagged.node);
    const variants = templateVariants(tagged.get('quasi'), context);
    const metadata = {
      ...extractStringEntryMetadata({
        output,
        config,
        nodeLoc: tagged.node.loc,
      }),
      ...hashMetadata,
      ...(context.usesDerive && {
        staticId: `derive-temp-id-${randomUUID()}`,
      }),
    };
    // Build every tree first so a failing variant skips the whole message.
    const trees = variants.map(({ strings, holes }) => {
      try {
        return buildMessageTree(strings, holes).tree;
      } catch (error) {
        // The builder rejects variable names that use its reserved prefix
        // and options a helper does not have.
        throw new NonStaticMessageError(
          'the message tree could not be built',
          tagged.node,
          formatDiagnosticErrorDetails(error)
        );
      }
    });
    for (const tree of trees) {
      output.updates.push({
        dataFormat: 'ICU_TREE',
        source: tree,
        // Each variant gets its own hash, so it needs its own metadata object.
        metadata: { ...metadata },
      });
    }
  } catch (error) {
    if (!(error instanceof NonStaticMessageError)) throw error;
    output.warnings.add(
      warnNonStaticMessageTreeSync(
        config.file,
        error.message,
        formatLocation(error.node),
        error.details,
        error.fix
      )
    );
  }
}
