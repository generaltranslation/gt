import { getBrowserI18nManager } from '../../browser-i18n-manager/singleton-operations';
import { getDefaultLocale, getLocale } from '../locale-operations';

/**
 * Equivalent to the `<Num>` component, but used for auto insertion
 */
function GtInternalNum({
  children,
  options = {},
  locales: localesProp = [],
}: {
  children: number | string | null | undefined;
  options?: Intl.NumberFormatOptions;
  locales?: string[];
  name?: string;
}): string | null {
  // Parse input
  if (children == null) return null;
  const parsedNumber =
    typeof children === 'string' ? parseFloat(children) : children;
  const locales = [...localesProp, getLocale(), getDefaultLocale()];

  // Apply formatting
  const i18nManager = getBrowserI18nManager();
  const gt = i18nManager.getGTClass();
  const formattedNumber = gt.formatNum(parsedNumber, { locales, ...options });

  // Return formatted number
  return formattedNumber;
}

/** @internal _gtt - The GT transformation for the component. */
GtInternalNum._gtt = 'variable-number';

export { GtInternalNum, GtInternalNum as Num };
