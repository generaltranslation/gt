import { androidLocaleQualifier } from './androidLocale.js';

import type { SupportedFileExtension } from '../../types/index.js';

/**
 * How each file type spells a locale inside a path.
 *
 * A file type belongs here only when its own tooling reads the locale back out
 * of the path. Everything else must stay verbatim, because a transform or a
 * static URL that spells a locale differently points at a file nothing wrote.
 */
const LOCALE_PATH_SPELLING: Partial<
  Record<SupportedFileExtension, (locale: string) => string>
> = {
  androidStrings: androidLocaleQualifier,
};

/** Returns the locale as `fileType` spells it in a path. */
export function localeForFilePath(
  fileType: SupportedFileExtension,
  locale: string
): string {
  return LOCALE_PATH_SPELLING[fileType]?.(locale) ?? locale;
}
