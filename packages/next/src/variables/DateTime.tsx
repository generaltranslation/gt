import { formatDateTime } from 'generaltranslation';
import getI18NConfig from '../config-dir/getI18NConfig';

/**
 * The `<DateTime>` component renders a formatted date or time string, allowing customization of the name, default value, and formatting options.
 * It utilizes the current locale and optional format settings to display the date.
 *
 * @example
 * ```jsx
 * <DateTime
 *    name="createdAt"
 * >
 *    {new Date()}
 * </DateTime>
 * ```
 *
 * @param {any} [children] - Optional content (typically a date) to render inside the component.
 * @param {string} [name="date"] - Optional name for the date field, used for metadata purposes.
 * @param {string|number|Date} [value] - The default value for the date. Can be a string, number (timestamp), or `Date` object.
 * @param {Intl.DateTimeFormatOptions} [options={}] - Optional formatting options for the date, following `Intl.DateTimeFormatOptions` specifications.
 * @returns {Promise<JSX.Element>} The formatted date or time component.
 */
function DateTime({
  children,
  name,
  value,
  options = {},
  locales = [getI18NConfig().getDefaultLocale()],
  ...props
}: {
  children?: any;
  name?: string;
  value?: any; // The default value which can be number, string, or Date
  options?: Intl.DateTimeFormatOptions; // Optional formatting options for the date
  locales?: string[];
  'data-_gt'?: any;
}): React.JSX.Element {
  const { 'data-_gt': generaltranslation } = props;
  if (typeof children !== 'undefined' && typeof value === 'undefined') {
    value = children;
  }
  if (!value) {
    return (
      <span
        data-_gt={generaltranslation}
        data-_gt-variable-name={name}
        data-_gt-variable-type={'date'}
        data-_gt-variable-options={options}
        style={{ display: 'contents' }}
      />
    );
  }

  // Convert value to a Date object if it's a Unix time, string, or Date object
  let dateValue: Date | undefined;

  if (typeof value === 'number') {
    dateValue = new Date(value * 1000); // Assuming Unix time is in seconds
  } else if (typeof value === 'string') {
    dateValue = new Date(value);
  } else if (value instanceof Date) {
    dateValue = value;
  }

  // Format the date according to the locale and options
  const dateString = dateValue
    ? formatDateTime({ value: dateValue, locales, options })
    : '';
  const formattedValue = dateString.replace(/[\u200F\u202B\u202E]/g, '');

  // Render the formatted date within a span element
  return (
    <span
      data-_gt={generaltranslation}
      data-_gt-variable-name={name}
      data-_gt-variable-type={'date'}
      data-_gt-variable-options={JSON.stringify(options)}
      data-_gt-unformatted-value={
        isValidDate(dateValue) ? dateValue : undefined
      }
      style={{ display: 'contents' }}
      suppressHydrationWarning
    >
      {formattedValue}
    </span>
  );
}

DateTime.gtTransformation = 'variable-datetime';

export default DateTime;

/**
 * Checks if the input is a valid date object or a string that can be converted to a date.
 * @param {any} input - The input to check.
 * @returns {boolean} - Returns true if the input is a valid date, false otherwise.
 */
function isValidDate(input: any): boolean {
  const date = new Date(input);
  return !isNaN(date.getTime());
}
