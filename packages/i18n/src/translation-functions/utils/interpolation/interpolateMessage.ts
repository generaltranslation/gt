import { getI18nManager } from '../../../i18n-manager/singleton-operations';
import { InlineTranslationOptions } from '../../types/options';
import { interpolateIcuMessage } from './interpolateIcuMessage';
import { interpolateStringMessage } from './interpolateStringMessage';
import type { StringFormat } from 'generaltranslation/types';

/**
 * Options for string interpolation
 * @internal
 */
export type InterpolationOptions = {
  $format: StringFormat;
} & Omit<InlineTranslationOptions, '$format'>;

/**
 * Interpolation router function for all {@link StringFormat} types
 */
export function interpolateMessage({
  source,
  target,
  options,
}: {
  source: string;
  target?: string;
  options: InterpolationOptions;
}): string {
  // Format translation
  if (target != null) {
    return routeInterpolation(target, {
      $_fallback: source,
      ...options,
    });
  }

  // Format source
  return routeInterpolation(source, {
    ...options,
    $locale: getI18nManager().getDefaultLocale(),
  });
}

// ----- HELPERS ----- //

/**
 * Route to appropriate formatting function
 */
function routeInterpolation(
  content: string,
  options: InlineTranslationOptions
): string {
  switch (options.$format ?? 'STRING') {
    case 'ICU':
      return interpolateIcuMessage(content, options);
    case 'I18NEXT':
    case 'STRING':
      return interpolateStringMessage(content, options);
    default:
      // e.g. $format: 'NONE'
      return content;
  }
}
