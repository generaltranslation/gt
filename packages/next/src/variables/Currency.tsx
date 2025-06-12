import { formatCurrency } from 'generaltranslation';
import getI18NConfig from '../config-dir/getI18NConfig';
import { useLocale } from '../request/getLocale';

function Currency({
  children,
  currency = 'USD',
  locales,
  options = {},
}: {
  children?: React.ReactNode;
  currency?: string;
  name?: string;
  options?: Intl.NumberFormatOptions;
  locales?: string[];
}): React.JSX.Element {
  if (!locales) {
    locales = [useLocale(), getI18NConfig().getDefaultLocale()];
  }

  // Determine the value to be formatted
  const renderedValue =
    typeof children === 'string' ? parseFloat(children) : children;

  // Format the number as currency according to the locale
  const formattedValue =
    typeof renderedValue === 'number'
      ? formatCurrency(renderedValue, currency, { locales, ...options })
      : renderedValue;

  return <>{formattedValue}</>;
}

Currency.gtTransformation = 'variable-currency';

export default Currency;
