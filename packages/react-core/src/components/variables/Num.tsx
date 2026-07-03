import { getReactI18nManager } from '../../i18n-manager/singleton-operations';
import { useFormatLocales } from '../../hooks/utils';

// ===== Component ===== //

function GtInternalNum({
  children,
  options = {},
  locales: localesProp = [],
}: {
  children: number | string | null | undefined;
  options?: Intl.NumberFormatOptions;
  locales?: string[];
  name?: string;
}): string | null {
  const locales = useFormatLocales(localesProp);
  const gt = getReactI18nManager().getGTClass();
  if (children == null) return null;
  const parsedNumber =
    typeof children === 'string' ? parseFloat(children) : children;
  return gt.formatNum(parsedNumber, { locales, ...options });
}

function Num(props: {
  children: number | string | null | undefined;
  options?: Intl.NumberFormatOptions;
  locales?: string[];
  name?: string;
}): string | null {
  return GtInternalNum(props);
}

/** @internal _gtt - The GT transformation for the component. */
GtInternalNum._gtt = 'variable-number-automatic';
Num._gtt = 'variable-number';

// ===== Exports ===== //

export { GtInternalNum, Num };
