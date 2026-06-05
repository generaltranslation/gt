import { getI18nConfig } from 'gt-i18n/internal';
import { getFormatLocales } from '../../hooks/format-locales';

type NumProps = {
  children: number | string | null | undefined;
  options?: Intl.NumberFormatOptions;
  locales?: string[];
  name?: string;
  _locale?: string;
  _enableI18n?: boolean;
};

type ResolvedNumProps = NumProps & {
  _locale: string;
  _enableI18n: boolean;
};

function computeNum({
  _enableI18n,
  _locale,
  children,
  options = {},
  locales: localesProp = [],
}: ResolvedNumProps): string | null {
  const locales = getFormatLocales({
    locale: _locale,
    enableI18n: _enableI18n,
    localesProp,
  });
  const gt = getI18nConfig().getGTClass();
  if (children == null) return null;
  const parsedNumber =
    typeof children === 'string' ? parseFloat(children) : children;
  return gt.formatNum(parsedNumber, { locales, ...options });
}

export { computeNum };
export type { NumProps, ResolvedNumProps };
