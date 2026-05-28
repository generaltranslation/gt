import { getReactI18nCache } from '../../i18n-cache/singleton-operations';
import { useEnableI18n, useLocale } from '../../hooks/condition-store';
import { getFormatLocales } from '../../hooks/utils';

type NumProps = {
  children: number | string | null | undefined;
  options?: Intl.NumberFormatOptions;
  locales?: string[];
  name?: string;
};

type GtInternalNumProps = NumProps & {
  _locale?: string;
  _enableI18n?: boolean;
};

type ResolvedNumProps = NumProps & {
  locale: string;
  enableI18n: boolean;
};

// ===== Shared Logic ===== //

function computeNum({
  children,
  enableI18n,
  locale,
  options = {},
  locales: localesProp = [],
}: ResolvedNumProps): string | null {
  const locales = getFormatLocales({ locale, enableI18n, localesProp });
  const gt = getReactI18nCache().getGTClass();
  if (children == null) return null;
  const parsedNumber =
    typeof children === 'string' ? parseFloat(children) : children;
  return gt.formatNum(parsedNumber, { locales, ...options });
}

// ===== Component ===== //

function GtInternalNum({
  _enableI18n,
  _locale,
  ...props
}: GtInternalNumProps): string | null {
  return computeNum({
    ...props,
    enableI18n: _enableI18n ?? useEnableI18n(),
    locale: _locale ?? useLocale(),
  });
}

function Num(props: NumProps): React.JSX.Element {
  return <GtInternalNum {...props} />;
}

/** @internal _gtt - The GT transformation for the component. */
GtInternalNum._gtt = 'variable-number-automatic';
Num._gtt = 'variable-number';

// ===== Exports ===== //

export { GtInternalNum, Num };
