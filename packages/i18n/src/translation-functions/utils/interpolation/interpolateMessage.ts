import {
  InlineTranslationOptions,
  NormalizedLookupOptions,
} from '../../types/options';
import { interpolateIcuMessage } from './interpolateIcuMessage';
import { interpolateStringMessage } from './interpolateStringMessage';
import type { StringFormat } from 'generaltranslation/types';

/**
 * Options for string interpolation
 * @internal
 */
export type InterpolationOptions = NormalizedLookupOptions<StringFormat>;

/**
 * Interpolation router function for all {@link StringFormat} types
 */
export function interpolateMessage({
  source,
  target,
  options,
  sourceLocale,
}: {
  source: string;
  target?: string;
  options: InterpolationOptions;
  sourceLocale?: string;
}): string {
  // Format translation
  if (target != null) {
    return routeInterpolation(target, {
      $_fallback: source,
      ...options,
    });
  }

  // Format source
  // Missing translations format the source with the source locale, not the target locale.
  return routeInterpolation(source, getSourceOptions(options, sourceLocale));
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

function getSourceOptions(
  options: InterpolationOptions,
  sourceLocale?: string
): InterpolationOptions {
  if (!sourceLocale) return options;
  return {
    ...options,
    $locale: sourceLocale,
  };
}
