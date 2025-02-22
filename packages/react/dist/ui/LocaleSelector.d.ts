import React from 'react';
/**
 * A dropdown component that allows users to select a locale.
 * @param {string[]} locales - The list of supported locales. By default this is the user's list of supported locales from the `<GTProvider>` context.
 * @returns {React.ReactElement | null} The rendered locale dropdown component or null to prevent rendering.
 */
export default function LocaleSelector({ locales, ...props }: {
    locales?: string[];
}): React.ReactElement | null;
//# sourceMappingURL=LocaleSelector.d.ts.map