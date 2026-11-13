// The formatters as the tests call them, with what a caller would resolve:
// English, no values, and the host's time zone, which intl-messageformat
// formats in too.
import {
  formatMessageTree as formatTree,
  type FormatMessageTreeOptions,
  type MessageTree,
  type MessageValues,
} from '../index';
import { formatIcu as formatString, type FormatIcuOptions } from '../parser';

export const hostTimeZone = new Intl.DateTimeFormat().resolvedOptions()
  .timeZone;

export function formatMessageTree(
  tree: MessageTree,
  locales: string | string[] = 'en',
  variables: MessageValues<unknown> = {},
  options?: Partial<FormatMessageTreeOptions>
): unknown {
  return formatTree<unknown>(tree, locales, variables, {
    formats: {},
    timeZone: hostTimeZone,
    ...options,
  });
}

export function formatIcu(
  message: string,
  locales: string | string[] = 'en',
  variables: MessageValues<unknown> = {},
  options?: Partial<FormatIcuOptions>
): unknown {
  return formatString<unknown>(message, locales, variables, {
    timeZone: hostTimeZone,
    ...options,
  });
}
