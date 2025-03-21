import { formatDateTime } from 'generaltranslation';
import getI18NConfig from '../config-dir/getI18NConfig';
import getLocale from '../request/getLocale';

/**
 * The `<DateTime>` component renders a formatted date or time string, allowing customization of the name, default value, and formatting options.
 * It utilizes the current locale and optional format settings to display the date.
 *
 * @example
 * ```jsx
 * <DateTime>
 *    {new Date()}
 * </DateTime>
 * ```
 *
 * @param {any} [children] - Optional content (typically a date) to render inside the component.
 * @param {Intl.DateTimeFormatOptions} [options={}] - Optional formatting options for the date, following `Intl.DateTimeFormatOptions` specifications.
 * @returns {Promise<React.JSX.Element>} The formatted date or time component.
 */
async function DateTime({
  children,
  options = {},
  locales = [getI18NConfig().getDefaultLocale()],
}: {
  children?: any;
  options?: Intl.DateTimeFormatOptions; // Optional formatting options for the date
  locales?: string[];
}): Promise<React.JSX.Element> {
  locales = [await getLocale(), ...locales];

  let final;
  let dateValue: Date | undefined;
  let defaultValue = children;
  if (typeof defaultValue === 'number') {
    dateValue = new Date(defaultValue);
  } else if (typeof defaultValue === 'string') {
    dateValue = new Date(defaultValue);
  } else if (defaultValue instanceof Date) {
    dateValue = defaultValue;
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
