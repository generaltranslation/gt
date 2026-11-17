/**
 * The part of the static runtime (see `static-runtime.ts`) for messages with
 * a number, date or time placeholder, which format through the same function
 * as gt-react's runtime. It is its own entry so a build without such a
 * message does not bundle that formatter.
 */
import { formatMessageTree } from 'generaltranslation/internal';

type FormatMessageTree = typeof formatMessageTree;

/**
 * Formats any message tree in the locales of its build.
 * @param locales The locale to format in, then the build's default locale, with a comma between them.
 * @param formats The formatting context of each formatted variable, such as a currency.
 * @param timeZone The configured time zone; without one, dates format in the host's.
 * @internal
 */
export function formatStaticIntl(
  tree: Parameters<FormatMessageTree>[0],
  values: Readonly<Record<string, unknown>>,
  locales: string,
  formats?: NonNullable<Parameters<FormatMessageTree>[3]>['formats'],
  timeZone?: string
): string {
  const formatted = formatMessageTree(tree, locales.split(','), values, {
    formats,
    timeZone,
  });
  return Array.isArray(formatted) ? formatted.join('') : String(formatted);
}
