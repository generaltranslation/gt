import { formatDateTime } from 'generaltranslation';
import getI18NConfig from '../config-dir/getI18NConfig';
import { getLocale, useLocale } from '../request/getLocale';

function DateTime({
  children,
  locales,
  options = {},
}: {
  children?: React.ReactNode;
  name?: string;
  options?: Intl.DateTimeFormatOptions; // Optional formatting options for the date
  locales?: string[];
}): React.JSX.Element {
  if (!locales) {
    locales = [useLocale(), getI18NConfig().getDefaultLocale()];
  }

  let final;
  let dateValue: Date | undefined;
  const defaultValue = children;
  if (typeof defaultValue === 'number') {
    dateValue = new Date(defaultValue);
  } else if (typeof defaultValue === 'string') {
    dateValue = new Date(defaultValue);
  } else if (defaultValue instanceof Date) {
    dateValue = defaultValue;
  }

  if (typeof dateValue !== 'undefined' && isNaN(dateValue.getTime())) {
    throw new Error(
      `DateTime Error -- Invalid date format: "${defaultValue}". Please use a Date object, valid date string, or number.`
    );
  }

  if (typeof dateValue !== 'undefined') {
    final = formatDateTime(dateValue, { locales, ...options }).replace(
      /[\u200F\u202B\u202E]/g,
      ''
    );
  }
  return <>{final}</>;
}

DateTime.gtTransformation = 'variable-datetime';

export default DateTime;
