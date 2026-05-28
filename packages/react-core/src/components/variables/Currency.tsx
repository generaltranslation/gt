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

type GtInternalCurrencyProps = CurrencyProps & {
  _locale?: string;
  _enableI18n?: boolean;
};

type ResolvedCurrencyProps = CurrencyProps & {
  locale: string;
  enableI18n: boolean;
};

// ===== Shared Logic ===== //

function computeCurrency({
  children,
  currency = 'USD',
  enableI18n,
  locale,
  options = {},
  locales: localesProp = [],
}: ResolvedCurrencyProps): string | null {
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

// ===== Component ===== //

function GtInternalCurrency({
  _enableI18n,
  _locale,
  ...props
}: GtInternalCurrencyProps): string | null {
  return computeCurrency({
    ...props,
    enableI18n: _enableI18n ?? useEnableI18n(),
    locale: _locale ?? useLocale(),
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
