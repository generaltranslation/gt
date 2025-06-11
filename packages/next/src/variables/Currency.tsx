import { formatCurrency } from 'generaltranslation';
import getI18NConfig from '../config-dir/getI18NConfig';
import getLocale from '../request/getLocale';

async function Currency({
  children,
  currency = 'USD',
  name,
  locales,
  options = {},
}: {
  children?: any;
  currency?: string;
  name?: string;
  options?: Intl.NumberFormatOptions;
  locales?: string[];
}): Promise<React.JSX.Element> {
  if (!locales) {
    locales = [await getLocale(), getI18NConfig().getDefaultLocale()];
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
