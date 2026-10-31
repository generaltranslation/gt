import * as t from '@babel/types';
import type { MessageTreeHashMetadata } from 'generaltranslation/id';
import { NonStaticMessageError } from './diagnostics.js';
import { getNumber, getPropertyKey, getStaticText } from './staticValues.js';

export function parseMessageOptions(
  args: t.CallExpression['arguments'] | undefined,
  tagged: t.Node
): MessageTreeHashMetadata {
  if (!args) return {};
  const [options] = args;
  if (args.length !== 1 || !t.isObjectExpression(options)) {
    throw new NonStaticMessageError(
      'the gt() options are not a single object literal',
      options ?? tagged
    );
  }
  const metadata: MessageTreeHashMetadata = {};
  for (const property of options.properties) {
    const key = getPropertyKey(property);
    const value = (property as t.ObjectProperty).value;
    if (key === 'context') {
      metadata.context = getStaticText(value, 'the context option');
    } else if (key === 'maxChars') {
      const maxChars = getNumber(value);
      if (maxChars == null || !Number.isInteger(maxChars)) {
        throw new NonStaticMessageError(
          'the maxChars option is not an integer literal',
          value
        );
      }
      // The sign never changes the hash; store the limit like other entries.
      metadata.maxChars = Math.abs(maxChars);
    } else if (key === 'requiresReview') {
      if (!t.isBooleanLiteral(value)) {
        throw new NonStaticMessageError(
          'the requiresReview option is not a boolean literal',
          value
        );
      }
      metadata.requiresReview = value.value;
    } else if (key !== 'locale') {
      // `locale` only picks the render locale; any other key is unsupported.
      throw new NonStaticMessageError(
        `the gt() option "${key}" is not supported`,
        property
      );
    }
  }
  return metadata;
}
