import type { NodePath } from '@babel/traverse';
import { traverseFast } from '@babel/types';
import type * as t from '@babel/types';
import { templateToMessage } from '@generaltranslation/icu/internal';
import { formatDiagnosticErrorDetails } from 'generaltranslation/diagnostics';
import { randomUUID } from 'node:crypto';
import { warnNonStaticMessageTreeSync } from '../../../../../console/index.js';
import { extractStringEntryMetadata } from './extractStringEntryMetadata.js';
import type { ParsingConfig, ParsingOutput } from '../types.js';
import { NonStaticMessageError, formatLocation } from './diagnostics.js';
import { parseMessageOptions } from './parseMessageOptions.js';
import { templateVariants } from './templateVariants.js';
import type { TagOptions, TreeContext } from './types.js';

/** `optionsFile` is where `options` are written, which a helper's caller may own. */
export function processMessage(
  tagged: NodePath<t.TaggedTemplateExpression>,
  options: TagOptions | undefined,
  optionsFile: string,
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
      ...extractStringEntryMetadata({ config, nodeLoc: tagged.node.loc }),
      ...hashMetadata,
      ...(context.usesDerive && {
        staticId: `derive-temp-id-${randomUUID()}`,
      }),
    };
    // Build every tree first so a failing variant skips the whole message.
    const trees = variants.map(({ strings, holes }) => {
      try {
        return templateToMessage(strings, holes).tree;
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
        dataFormat: 'MESSAGE_TREE',
        source: tree,
        // Each variant gets its own hash, so it needs its own metadata object.
        metadata: { ...metadata },
      });
    }
  } catch (error) {
    if (!(error instanceof NonStaticMessageError)) throw error;
    reportSkippedMessage(
      error,
      options?.some((option) => containsNode(option, error.node))
        ? optionsFile
        : config.file,
      config,
      output
    );
  }
}

/** Reports a message skipped because of `error`, found in `file`. */
export function reportSkippedMessage(
  error: NonStaticMessageError,
  file: string,
  config: ParsingConfig,
  output: ParsingOutput
): void {
  const skipped = warnNonStaticMessageTreeSync(
    file,
    error.message,
    formatLocation(error.node),
    error.details,
    error.fix
  );
  if (!config.skippedMessagesAreErrors) {
    output.warnings.add(skipped);
  } else if (!output.errors.includes(skipped)) {
    // Two messages that share a part`...` report the same skip, which the
    // warnings set drops.
    output.errors.push(skipped);
  }
}

function containsNode(root: t.Node, target: t.Node): boolean {
  let found = false;
  traverseFast(root, (node) => {
    if (node === target) found = true;
  });
  return found;
}
