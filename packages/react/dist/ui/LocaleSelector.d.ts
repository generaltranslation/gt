import React from 'react';
/**
 * A dropdown component that allows users to select a locale.
 * @param {string[]} locales - The list of supported locales. By default this is the user's list of supported locales from the `<GTProvider>` context.
 * @param {(a: string, b: string) => number} compare - A comparison function that defines the sort order of the locales. By default this sorts the locales by their native name with region code.
 * @returns {React.ReactElement | null} The rendered locale dropdown component or null to prevent rendering.
 */
export default function LocaleSelector({ locales, compare, ...props }: {
    locales?: string[];
    compare?: (a: string, b: string) => number;
    [key: string]: any;
}): React.ReactElement | null;
//# sourceMappingURL=LocaleSelector.d.ts.map