/**
 * What a build made with the compiler's experimental
 * `experimentalStaticRuntime` option runs instead of gt-react: the compiler
 * resolves every translation for the build's one locale, so the app only
 * formats the messages that have variables. Compiled code imports this entry;
 * it is not written by hand.
 */
import { formatMessageTree } from 'generaltranslation/internal';

type FormatMessageTree = typeof formatMessageTree;

/** Formats a message tree in the locale its build was made for. */
export type StaticFormatter = (
  tree: Parameters<FormatMessageTree>[0],
  values: Readonly<Record<string, unknown>>,
  formats?: NonNullable<Parameters<FormatMessageTree>[3]>['formats']
) => string;

/**
 * A formatter for the message trees of one build.
 * @param locales The build's locale, then its default locale, as Intl reads them.
 * @param timeZone The configured time zone; without one, dates format in the host's.
 * @internal
 */
export function createStaticFormatter(
  locales: string[],
  timeZone?: string
): StaticFormatter {
  return (tree, values, formats) => {
    const formatted = formatMessageTree(tree, locales, values, {
      formats,
      timeZone,
    });
    return Array.isArray(formatted) ? formatted.join('') : String(formatted);
  };
}

/**
 * Stands in for gt-react's `initializeGTSPA()`: the build already holds its
 * locale and translations, so there is nothing to start or load.
 * @internal
 */
export async function initializeGTSPA(_config?: unknown): Promise<void> {}
