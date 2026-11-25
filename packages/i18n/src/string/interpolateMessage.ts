import type {
  TranslationOptions,
  NormalizedLookupOptions,
} from '../translation-functions/types/options';
import { formatCutoff } from './formatCutoff';
import { interpolateIcuMessage } from './interpolateIcuMessage';
import { interpolateStringMessage } from './interpolateStringMessage';
import type { StringFormat } from '@generaltranslation/format';

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
    const sourceOptions = getSourceOptions(options, sourceLocale);
    // The default locale's entry is its own source: a retry would fail alike.
    const fallback =
      target === source && options.$locale === sourceOptions.$locale
        ? undefined
        : () =>
            // The same variable is often missing from both: keep the reader's language.
            routeInterpolation(source, sourceOptions, () =>
              formatCutoff(target, options.$maxChars, options.$locale)
            );
    return routeInterpolation(target, options, fallback);
  }

  // Format source
  // Missing translations format the source with the source locale, not the target locale.
  // TODO: Consider formatting dates, numbers, etc. with the target locale while keeping plurals in the source locale.
  return routeInterpolation(source, getSourceOptions(options, sourceLocale));
}

// ----- HELPERS ----- //

/**
 * Route to appropriate formatting function
 */
function routeInterpolation(
  content: string,
  options: TranslationOptions,
  fallback?: () => string
): string {
  switch (options.$format ?? 'STRING') {
    case 'ICU':
      return interpolateIcuMessage(content, options, fallback);
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
