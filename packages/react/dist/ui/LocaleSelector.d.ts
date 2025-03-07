import React from 'react';
/**
 * A dropdown component that allows users to select a locale.
 * @param {string[]} locales - An optional list of locales to use for the dropdown. If not provided, the list of locales from the `<GTProvider>` context is used.
 * @returns {React.ReactElement | null} The rendered locale dropdown component or null to prevent rendering.
 */
export default function LocaleSelector({ locales: _locales, ...props }: {
    locales?: string[];
    [key: string]: any;
}): React.JSX.Element | null;
//# sourceMappingURL=LocaleSelector.d.ts.map