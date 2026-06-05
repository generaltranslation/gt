import { getI18nConfig } from 'gt-i18n/internal';
import { getFormatLocales } from '../../hooks/format-locales';

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

export { computeCurrency };
export type { CurrencyProps, ResolvedCurrencyProps };
