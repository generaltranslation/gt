import { computeCurrency as computeCurrencyBase } from 'gt-i18n/internal';

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
  currency,
  options,
  locales,
}: ResolvedCurrencyProps): string | null {
  return computeCurrencyBase({
    value: children,
    currency,
    options,
    locales,
    locale: _locale,
    enableI18n: _enableI18n,
  });
}

export { computeCurrency };
export type { CurrencyProps, ResolvedCurrencyProps };
