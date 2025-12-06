import { createInvalidCutoffStyleError } from '../../../errors/formattingErrors';
import { libraryDefaultLocale } from '../../../settings/settings';
import {
  DEFAULT_CUTOFF_FORMAT_STYLE,
  DEFAULT_TERMINATOR_KEY,
  TERMINATOR_MAP,
} from './constants';
import {
  CutoffFormat,
  CutoffFormatOptions,
  CutoffFormatStyle,
  PostpendedCutoffParts,
  PrependedCutoffParts,
  ResolvedCutoffFormatOptions,
  ResolvedTerminatorOptions,
} from './types';

export class CutoffFormatConstructor implements CutoffFormat {
  private locale: string;
  private options: ResolvedCutoffFormatOptions;

  /**
   * Constructor
   * @param {string | string[]} locales - The locales to use for formatting.
   * @param {CutoffFormatOptions} options - The options for formatting.
   * @param {number} [option.maxChars] - The maximum number of characters to display.
   * - Undefined values are treated as no cutoff.
   * - Negative values follow .slice() behavior and terminator will be added before the value.
   * - 0 will result in an empty string.
   * - If cutoff results in an empty string, no terminator is added.
   * @param {CutoffFormatStyle} [option.style='ellipsis'] - The style of the terminator.
   * @param {string} [option.terminator] - Optional override the terminator to use.
   * @param {string} [option.separator] - Optional override the separator to use between the terminator and the value.
   * - If no terminator is provided, then separator is ignored.
   *
   * @example
   * const format = new CutoffFormat('en', { maxChars: 5 });
   * format.format('Hello, world!'); // 'Hello...'
   *
   * const format = new CutoffFormat('en', { maxChars: -3 });
   * format.format('Hello, world!'); // '...ld!'
   */
  constructor(
    locales: Intl.LocalesArgument,
    options: CutoffFormatOptions = {}
  ) {
    // Determine locale (this replicates Intl.NumberFormat behavior including silent failure)
    try {
      // Normalize locales to string
      const localesList = !locales
        ? [libraryDefaultLocale]
        : Array.isArray(locales)
          ? locales.map((l) => String(l))
          : [String(locales)];
      const canonicalLocales = Intl.getCanonicalLocales(localesList);
      this.locale = canonicalLocales.length
        ? canonicalLocales[0]
        : libraryDefaultLocale;
    } catch {
      this.locale = libraryDefaultLocale;
    }

    // Follows Intl.NumberFormat behavior of throwing an error when currency is invalid
    if (!TERMINATOR_MAP[options.style ?? DEFAULT_CUTOFF_FORMAT_STYLE]) {
      throw new Error(
        createInvalidCutoffStyleError(
          options.style ?? DEFAULT_CUTOFF_FORMAT_STYLE
        )
      );
    }

    // Resolve terminator options
    let style: CutoffFormatStyle | undefined;
    let presetTerminatorOptions: ResolvedTerminatorOptions | undefined;
    if (options.maxChars !== undefined) {
      style = options.style ?? DEFAULT_CUTOFF_FORMAT_STYLE;
      // TODO: need more sophisticated locale negotiation if we want to add support for region/script/etc.-specific terminators in the future
      const languageCode = new Intl.Locale(this.locale).language;
      presetTerminatorOptions =
        TERMINATOR_MAP[style][languageCode] ||
        TERMINATOR_MAP[style][DEFAULT_TERMINATOR_KEY];
    }
    let terminator: ResolvedTerminatorOptions['terminator'] =
      options.terminator ?? presetTerminatorOptions?.terminator;
    let separator: ResolvedTerminatorOptions['separator'] =
      terminator != null
        ? (options.separator ?? presetTerminatorOptions?.separator)
        : undefined;
    // Remove terminator and separator if maxChars does have enough space
    const additionLength = (terminator?.length ?? 0) + (separator?.length ?? 0);
    if (
      options.maxChars !== undefined &&
      Math.abs(options.maxChars) <= additionLength
    ) {
      terminator = undefined;
      separator = undefined;
    }

    this.options = {
      maxChars: options.maxChars,
      style,
      terminator,
      separator,
    };
  }

  /**
   * Format a value according to the cutoff options, returning a formatted string.
   *
   * @param {string} value - The string value to format with cutoff behavior.
   * @returns {string} The formatted string with terminator applied if cutoff occurs.
   *
   * @example
   * const formatter = new CutoffFormatConstructor('en', { maxChars: 8, style: 'ellipsis' });
   * formatter.format('Hello, world!'); // Returns 'Hello, w...'
   */
  format(value: string): string {
    return this.formatToParts(value).join('');
  }

  /**
   * Format a value to parts according to the cutoff options, returning an array of string parts.
   * This method breaks down the formatted result into individual components for more granular control.
   *
   * @param {string} value - The string value to format with cutoff behavior.
   * @returns {PrependedCutoffParts | PostpendedCutoffParts} An array of string parts representing the formatted result.
   *   - For positive maxChars: [cutoffValue, separator?, terminator?]
   *   - For negative maxChars: [terminator?, separator?, cutoffValue]
   *   - For no cutoff: [originalValue]
   *
   * @example
   * const formatter = new CutoffFormatConstructor('en', { maxChars: 5, style: 'ellipsis' });
   * formatter.formatToParts('Hello, world!'); // Returns ['Hello', '...']
   */
  formatToParts(value: string): PrependedCutoffParts | PostpendedCutoffParts {
    const { maxChars, terminator, separator } = this.options;
    const additionLength = (terminator?.length ?? 0) + (separator?.length ?? 0);
    const adjustedChars =
      maxChars === undefined || maxChars === value.length
        ? maxChars
        : maxChars >= 0
          ? Math.max(0, maxChars - additionLength)
          : Math.min(0, maxChars + additionLength);

    const slicedValue =
      adjustedChars !== undefined && adjustedChars > -1
        ? value.slice(0, adjustedChars)
        : value.slice(adjustedChars);

    // No cutoff, no terminator -> value only
    if (
      maxChars == null ||
      adjustedChars == null ||
      terminator == null ||
      value.length <= Math.abs(maxChars)
    ) {
      return [slicedValue];
    }

    // Postpended cutoff
    if (adjustedChars > 0) {
      return separator != null
        ? [slicedValue, separator, terminator]
        : [slicedValue, terminator];
    }
    // Prepended cutoff
    else {
      return separator != null
        ? [terminator, separator, slicedValue]
        : [terminator, slicedValue];
    }
  }

  /**
   * Get the resolved options
   * @returns {ResolvedCutoffFormatOptions} The resolved options.
   */
  resolvedOptions(): ResolvedCutoffFormatOptions {
    return this.options;
  }
}
