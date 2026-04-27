import { formatNum } from 'generaltranslation';
import { getDefaultLocale, getLocale } from '../locale-operations';

/**
 * Equivalent to the `<Num>` component, but used for auto insertion
 */
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
  // Parse input
  if (children == null) return null;
  const parsedNumber =
    typeof children === 'string' ? parseFloat(children) : children;
  const locales = [...localesProp, getLocale(), getDefaultLocale()];

  // Apply formatting
  const formattedNumber = formatNum(parsedNumber, { locales, ...options });

  // Return formatted number
  return formattedNumber;
}

/**
 * User facing component for the `<Num>` variable
 */
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

export { GtInternalNum, Num };
