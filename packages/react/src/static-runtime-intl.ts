/**
 * The part of the static runtime (see `static-runtime.ts`) for messages with
 * a number, date or time placeholder, which format through the same function
 * as gt-react's runtime. It is its own entry so a build without such a
 * message does not bundle that formatter.
 */
import { formatMessageTree } from 'generaltranslation/internal';

type FormatMessageTree = typeof formatMessageTree;

/** Formats any message tree in the locale its build was made for. */
export type StaticIntlFormatter = (
  tree: Parameters<FormatMessageTree>[0],
  values: Readonly<Record<string, unknown>>,
  formats?: NonNullable<Parameters<FormatMessageTree>[3]>['formats']
) => string;

/**
 * A formatter for the message trees of one build that hold a number, a date
 * or a time.
 * @param locales The build's locale, then its default locale, as Intl reads them.
 * @param timeZone The configured time zone; without one, dates format in the host's.
 * @internal
 */
export function createStaticIntlFormatter(
  locales: string[],
  timeZone?: string
): StaticIntlFormatter {
  return (tree, values, formats) => {
    const formatted = formatMessageTree(tree, locales, values, {
      formats,
      timeZone,
    });
    return Array.isArray(formatted) ? formatted.join('') : String(formatted);
  };
}
