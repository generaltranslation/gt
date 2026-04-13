import { InlineTranslationOptions } from '../../types/options';
import { interpolateIcuMessage } from './interpolateIcuMessage';
import { interpolateStringMessage } from './interpolateStringMessage';

/**
 * Interpolation router function for all {@link StringFormat} types
 */
export function interpolateMessage(
  message: string,
  options: InlineTranslationOptions
): string;
// ICU
export function interpolateMessage<T extends string | null | undefined>(
  message: T,
  options: InlineTranslationOptions
): T extends string ? string : T;
export function interpolateMessage<T extends string | null | undefined>(
  message: T,
  options: InlineTranslationOptions
): T extends string ? string : T {
  if (typeof message !== 'string')
    return message as T extends string ? string : T;

  switch (options.$format ?? 'STRING') {
    case 'ICU':
      return interpolateIcuMessage(message, options);
    case 'I18NEXT':
    case 'STRING':
      return interpolateStringMessage(message, options) as T extends string
        ? string
        : T;
    default:
      // e.g. $format: 'NONE'
      return message as T extends string ? string : T;
  }
}
