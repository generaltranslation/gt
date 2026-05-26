import { getReactI18nCache } from '../../i18n-cache/singleton-operations';
import { useFormatLocales } from '../../hooks/utils';

type NumProps = {
  children: number | string | null | undefined;
  options?: Intl.NumberFormatOptions;
  locales?: string[];
  name?: string;
};

// ===== Component ===== //

function GtInternalNum({
  children,
  options = {},
  locales: localesProp = [],
}: NumProps): string | null {
  const locales = useFormatLocales(localesProp);
  const gt = getReactI18nCache().getGTClass();
  if (children == null) return null;
  const parsedNumber =
    typeof children === 'string' ? parseFloat(children) : children;
  return gt.formatNum(parsedNumber, { locales, ...options });
}

function Num(props: NumProps): React.JSX.Element {
  return <GtInternalNum {...props} />;
}

/** @internal _gtt - The GT transformation for the component. */
GtInternalNum._gtt = 'variable-number-automatic';
Num._gtt = 'variable-number';

// ===== Exports ===== //

export { GtInternalNum, Num };
