import { getReactI18nCache } from '../../i18n-cache/singleton-operations';
import { useEnableI18n, useLocale } from '../../hooks/condition-store';
import { getFormatLocales } from '../../hooks/utils';

type CurrencyProps = {
  children: number | string | null | undefined;
  currency?: string;
  options?: Intl.NumberFormatOptions;
  locales?: string[];
  name?: string;
};

// ===== Component ===== //

function GtInternalCurrency({
  children,
  currency = 'USD',
  options = {},
  locales: localesProp = [],
}: CurrencyProps): string | null {
  const locale = useLocale();
  const enableI18n = useEnableI18n();
  const locales = getFormatLocales({ locale, enableI18n, localesProp });
  const gt = getReactI18nCache().getGTClass();
  if (children == null) return null;
  const parsedNumber =
    typeof children === 'string' ? parseFloat(children) : children;
  return gt.formatCurrency(parsedNumber, currency, {
    locales,
    ...options,
  });
}

function Currency(props: CurrencyProps): React.JSX.Element {
  return <GtInternalCurrency {...props} />;
}

/** @internal _gtt - The GT transformation for the component. */
GtInternalCurrency._gtt = 'variable-currency-automatic';
Currency._gtt = 'variable-currency';

// ===== Exports ===== //

export { GtInternalCurrency, Currency };
