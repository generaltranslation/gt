import { formatCutoff as formatUnconfiguredCutoff } from 'generaltranslation/internal';
import {
  getI18nConfig,
  isI18nConfigInitialized,
} from '../../i18n-config/singleton-operations';

/**
 * Cuts a message to `maxChars`, with the terminator of its locale: a French
 * ellipsis has a space before it, a Chinese one is twice as long.
 */
export function formatCutoff(
  value: string,
  maxChars: number | undefined,
  locales?: string | string[]
): string {
  // Fallback helpers also work before initializeGT(). Once configured, use
  // its custom mapping so app aliases never reach Intl as language codes.
  if (!isI18nConfigInitialized()) {
    return formatUnconfiguredCutoff(value, { locales, maxChars });
  }
  return getI18nConfig().formatCutoff(value, undefined, { locales, maxChars });
}
