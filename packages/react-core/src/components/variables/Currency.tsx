import { getI18nConfig } from 'gt-i18n/internal';
import { useEnableI18n, useLocale } from '../../hooks/condition-store';
import { getFormatLocales } from '../../hooks/utils';

type CurrencyProps = {
  children: number | string | null | undefined;
  currency?: string;
  options?: Intl.NumberFormatOptions;
  locales?: string[];
  name?: string;
  _locale?: string;
  _enableI18n?: boolean;
};

type ResolvedCurrencyProps = CurrencyProps & {
  _locale: string;
  _enableI18n: boolean;
};

// ===== Shared Logic ===== //

function computeCurrency({
  _enableI18n,
  _locale,
  children,
  currency = 'USD',
  options = {},
  locales: localesProp = [],
}: ResolvedCurrencyProps): string | null {
  const locales = getFormatLocales({
    locale: _locale,
    enableI18n: _enableI18n,
    localesProp,
  });
  const gt = getI18nConfig().getGTClass();
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
}: CurrencyProps): string | null {
  return computeCurrency({
    ...props,
    _enableI18n: _enableI18n ?? useEnableI18n(),
    _locale: _locale ?? useLocale(),
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
