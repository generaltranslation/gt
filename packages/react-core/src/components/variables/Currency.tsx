import { getReactI18nCache } from '../../i18n-cache/singleton-operations';
import { useFormatLocales } from '../../hooks/utils';

// ===== Component ===== //

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
  const locales = useFormatLocales(localesProp);
  const gt = getReactI18nCache().getGTClass();
  if (children == null) return null;
  const parsedNumber =
    typeof children === 'string' ? parseFloat(children) : children;
  return gt.formatCurrency(parsedNumber, currency, {
    locales,
    ...options,
  });
}

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

// ===== Exports ===== //

export { GtInternalCurrency, Currency };
