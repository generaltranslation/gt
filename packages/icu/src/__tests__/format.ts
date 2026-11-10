// The formatters as the tests call them: in the host's time zone, which
// intl-messageformat formats in too, unless a test passes another.
import {
  formatMessageTree as formatTree,
  type FormatMessageTreeOptions,
  type MessageTree,
  type MessageTreeValues,
} from '../index';
import { formatMessage as formatIcu } from '../parser';

export const hostTimeZone = new Intl.DateTimeFormat().resolvedOptions()
  .timeZone;

export function formatMessageTree(
  tree: MessageTree,
  locales?: string | string[],
  variables: MessageTreeValues<unknown> = {},
  options?: Partial<FormatMessageTreeOptions>
): unknown {
  return formatTree<unknown>(tree, locales, variables, {
    timeZone: hostTimeZone,
    ...options,
  });
}

export function formatMessage(
  message: string,
  locales?: string | string[],
  variables: MessageTreeValues<unknown> = {},
  options?: Partial<FormatMessageTreeOptions>
): unknown {
  return formatIcu<unknown>(message, locales, variables, {
    timeZone: hostTimeZone,
    ...options,
  });
}
