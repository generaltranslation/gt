import { formatCurrency } from 'generaltranslation';
import { getDefaultLocale, getLocale } from '../locale-operations';

/**
 * Equivalent to the `<Currency>` component, but used for auto insertion
 */
function GtInternalCurrency({
  children,
  currency = 'USD',
  options = {},
  locales: localesProp = [],
}: {
  children: number | string | null | undefined;
  currency?: string;
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
  const formattedCurrency = formatCurrency(parsedNumber, currency, {
    locales,
    ...options,
  });

  // Return formatted currency
  return formattedCurrency;
}

/**
 * User facing component for the `<Currency>` variable
 */
function Currency(props: {
  children: number | string | null | undefined;
  currency?: string;
  options?: Intl.NumberFormatOptions;
  locales?: string[];
  name?: string;
}): string | null {
  return GtInternalCurrency(props);
}

/** @internal _gtt - The GT transformation for the component. */
GtInternalCurrency._gtt = 'variable-currency-automatic';
Currency._gtt = 'variable-currency';

export { GtInternalCurrency, Currency };
