import React from "react";
import { formatDateTime } from "generaltranslation";
import useLocale from "../hooks/useLocale";
import useDefaultLocale from "../hooks/useDefaultLocale";

/**
 * The `<DateTime>` component renders a formatted date or time string, allowing customization of the name, default value, and formatting options.
 * It utilizes the current locale and optional format settings to display the date.
 * Must be used inside a `<GTProvider>`.
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
 * @returns {JSX.Element} The formatted date or time component.
 */
function DateTime({
  children,
  value,
  name,
  locales,
  options = {},
}: {
  children?: any;
  name?: string;
  value?: any; // The default value which can be string, number or Date
  locales?: string[];
  options?: Intl.DateTimeFormatOptions; // Optional formatting options for the date
}): React.JSX.Element {
  const providerLocales = [useLocale(), useDefaultLocale()];
  locales ||= providerLocales;

  let final;

  let dateValue: Date | undefined;
  let defaultValue =
    typeof children !== "undefined" && typeof value === "undefined"
      ? children
      : value;
  if (typeof defaultValue === "number") {
    dateValue = new Date(defaultValue);
  } else if (typeof defaultValue === "string") {
    dateValue = new Date(defaultValue);
  } else if (defaultValue instanceof Date) {
    dateValue = defaultValue;
  }
  if (typeof dateValue !== "undefined") {
    final = formatDateTime({ value: dateValue, locales, options }).replace(
      /[\u200F\u202B\u202E]/g,
      ""
    );
  }

  // Render the formatted date within a span element
  return (
    <span
      data-_gt-variable-name={name}
      data-_gt-variable-type={"date"}
      data-_gt-variable-options={JSON.stringify(options)}
      style={{ display: "contents" }}
      suppressHydrationWarning
    >
      {final}
    </span>
  );
}

// Static property for transformation type
DateTime.gtTransformation = "variable-datetime";

export default DateTime;
