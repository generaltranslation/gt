import React, { useContext } from 'react';
import { formatNum } from 'generaltranslation';
import { GTContext } from '../provider/GTContext';
import { libraryDefaultLocale } from 'generaltranslation/internal';

/**
 * The `<Num>` component renders a formatted number string, allowing customization of the name, default value, and formatting options.
 * It formats the number according to the current locale and optionally passed formatting options.
 * Must be used inside a `<GTProvider>`.
 *
 * @example
 * ```jsx
 * <Num
 *    options={{ style: "decimal", maximumFractionDigits: 2 }}
 * >
 *    1000
 * </Num>
 * ```
 *
 * @param {any} [children] - Optional content (typically a number) to render inside the component.
 * @param {Intl.NumberFormatOptions} [options={}] - Optional formatting options for the number, following `Intl.NumberFormatOptions` specifications.
 * @returns {JSX.Element} The formatted number component.
 */
function Num({
  children,
  name,
  locales,
  options = {},
}: {
  children?: any;
  locales?: string[];
  options?: Intl.NumberFormatOptions; // Optional options for the number formatting
  name?: string;
}): React.JSX.Element {
  const context = useContext(GTContext);
  if (context) {
    locales ||= [
      ...(context.locale && [context.locale]),
      context.defaultLocale,
    ];
  } else {
    locales ||= [libraryDefaultLocale];
  }

  let renderedValue =
    typeof children === 'string' ? parseFloat(children) : children;
  if (typeof renderedValue === 'number') {
    // Using Intl.NumberFormat for consistent number formatting
    renderedValue = formatNum(renderedValue, { locales, ...options });
  }
  return <>{renderedValue}</>;
}

Num.gtTransformation = 'variable-number';

export default Num;
