import { getI18nConfig } from 'gt-i18n/internal';
import { getFormatLocales } from '../../hooks/utils/getFormatLocales';

// Pure compute logic shared by the hook-based and RSC implementations. This
// module must stay free of hook/context imports so it can be reached from the
// components-rsc entrypoint.

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
  const i18nConfig = getI18nConfig();
  if (children == null) return null;
  const parsedNumber =
    typeof children === 'string' ? parseFloat(children) : children;
  return i18nConfig.formatCurrency(parsedNumber, currency, undefined, {
    locales,
    ...options,
  });
}

export { computeCurrency };
export type { CurrencyProps, ResolvedCurrencyProps };
