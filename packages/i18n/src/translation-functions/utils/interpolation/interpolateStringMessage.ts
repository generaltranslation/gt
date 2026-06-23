import { formatCutoff } from '@generaltranslation/format';
import { extractVariables } from '../../../utils/extractVariables';
import { formatMessage } from '../formatMessage';
import { InlineTranslationOptions } from '../../types/options';

/**
 * String interpolation function
 */
export function interpolateStringMessage(
  encodedMsg: string,
  options: InlineTranslationOptions
): string {
  const message =
    options.$format === 'I18NEXT'
      ? formatMessage(
          encodedMsg,
          extractVariables(options),
          options.$locale ?? options.$_locales,
          options.$format
        )
      : encodedMsg;

  const cutoffMessage = formatCutoff(message, {
    locales: options.$locale ?? options.$_locales,
    maxChars: options.$maxChars,
  });
  return cutoffMessage;
}
