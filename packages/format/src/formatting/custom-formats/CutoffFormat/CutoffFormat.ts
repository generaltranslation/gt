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
  PostpendedCutoffParts,
  PrependedCutoffParts,
  ResolvedCutoffFormatOptions,
} from './types';

export class CutoffFormatConstructor implements CutoffFormat {
  private locale: string;
  private options: ResolvedCutoffFormatOptions;
  private additionLength: number;

  private static resolveLocale(locales: Intl.LocalesArgument) {
    try {
      // Normalize locales to string
      const localesList = !locales
        ? [libraryDefaultLocale]
        : Array.isArray(locales)
          ? locales.map(String)
          : [String(locales)];
      const [canonicalLocale] = Intl.getCanonicalLocales(localesList);
      return canonicalLocale ?? libraryDefaultLocale;
    } catch {
      return libraryDefaultLocale;
    }
  }

  /**
   * Constructor
   * @param {Intl.LocalesArgument} locales - The locales to use for formatting.
   * @param {CutoffFormatOptions} options - The options for formatting.
   * @param {number} [options.maxChars] - The maximum number of characters to display.
   * - Undefined values are treated as no cutoff.
   * - Negative values follow .slice() behavior and terminator will be added before the value.
   * - 0 will result in an empty string.
   * - If cutoff results in an empty string, no terminator is added.
   * @param {CutoffFormatStyle} [options.style='ellipsis'] - The style of the terminator.
   * @param {string} [options.terminator] - Optional override the terminator to use.
   * @param {string} [options.separator] - Optional override the separator to use between the terminator and the value.
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
    this.locale = CutoffFormatConstructor.resolveLocale(locales);

    // Follows Intl.NumberFormat behavior of throwing an error when currency is invalid
    const style = options.style ?? DEFAULT_CUTOFF_FORMAT_STYLE;
    if (!TERMINATOR_MAP[style]) {
      throw new Error(createInvalidCutoffStyleError(style));
    }

    // Resolve terminator options.
    // TODO: need more sophisticated locale negotiation if we want to add support for region/script/etc.-specific terminators in the future
    const presetTerminatorOptions =
      options.maxChars === undefined
        ? undefined
        : TERMINATOR_MAP[style][new Intl.Locale(this.locale).language] ||
          TERMINATOR_MAP[style][DEFAULT_TERMINATOR_KEY];
    let terminator = options.terminator ?? presetTerminatorOptions?.terminator;
    let separator =
      terminator != null
        ? (options.separator ?? presetTerminatorOptions?.separator)
        : undefined;
    // Remove terminator and separator if maxChars cannot fit them.
    this.additionLength = (terminator?.length ?? 0) + (separator?.length ?? 0);
    if (
      options.maxChars !== undefined &&
      Math.abs(options.maxChars) < this.additionLength
    ) {
      terminator = undefined;
      separator = undefined;
    }

    this.options = {
      maxChars: options.maxChars,
      style: options.maxChars === undefined ? undefined : style,
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

    // Slice our value.
    const adjustedChars =
      maxChars === undefined || Math.abs(maxChars) >= value.length
        ? maxChars
        : maxChars >= 0
          ? Math.max(0, maxChars - this.additionLength)
          : Math.min(0, maxChars + this.additionLength);
    const slicedValue =
      adjustedChars !== undefined && adjustedChars > -1
        ? value.slice(0, adjustedChars)
        : value.slice(adjustedChars);

    // No cutoff, no terminator -> value only
    if (
      maxChars == null ||
      adjustedChars == null ||
      adjustedChars === 0 ||
      terminator == null ||
      value.length <= Math.abs(maxChars)
    ) {
      return [slicedValue];
    }

    // Postpended cutoff.
    if (adjustedChars > 0) {
      return separator != null
        ? [slicedValue, separator, terminator]
        : [slicedValue, terminator];
    }
    // Prepended cutoff.
    return separator != null
      ? [terminator, separator, slicedValue]
      : [terminator, slicedValue];
  }

  /**
   * Get the resolved options
   * @returns {ResolvedCutoffFormatOptions} The resolved options.
   */
  resolvedOptions(): ResolvedCutoffFormatOptions {
    return this.options;
  }
}
