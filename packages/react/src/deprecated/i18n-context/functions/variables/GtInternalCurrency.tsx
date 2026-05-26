import { getI18nCache } from 'gt-i18n/internal';
import { getDefaultLocale, getLocale } from '../locale-operations';

type CurrencyProps = {
  children: number | string | null | undefined;
  currency?: string;
  options?: Intl.NumberFormatOptions;
  locales?: string[];
  name?: string;
};

/**
 * Equivalent to the `<Currency>` component, but used for auto insertion
 */
function GtInternalCurrency({
  children,
  currency = 'USD',
  options = {},
  locales: localesProp = [],
}: CurrencyProps): string | null {
  // Parse input
  if (children == null) return null;
  const parsedNumber =
    typeof children === 'string' ? parseFloat(children) : children;
  const locales = [...localesProp, getLocale(), getDefaultLocale()];

  // Apply formatting
  const i18nCache = getI18nCache();
  const gt = i18nCache.getGTClass();
  const formattedCurrency = gt.formatCurrency(parsedNumber, currency, {
    locales,
    ...options,
  });

  // Return formatted currency
  return formattedCurrency;
}

/**
 * User facing component for the `<Currency>` variable
 */
function Currency(props: CurrencyProps): string | null {
  return GtInternalCurrency(props);
}

/** @internal _gtt - The GT transformation for the component. */
GtInternalCurrency._gtt = 'variable-currency-automatic';
Currency._gtt = 'variable-currency';

export { GtInternalCurrency, Currency };
