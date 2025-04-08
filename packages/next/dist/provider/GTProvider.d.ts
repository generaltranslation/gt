import { ReactNode } from 'react';
/**
 * Provides General Translation context to its children, which can then access `useGT`, `useLocale`, and `useDefaultLocale`.
 *
 * @param {React.ReactNode} children - The children components that will use the translation context.
 * @param {string} id - ID of a nested dictionary, so that only a subset of a large dictionary needs to be sent to the client.
 * @param {string} locale - The locale to use for the translation context.
 *
 * @returns {JSX.Element} The provider component for General Translation context.
 */
export default function GTProvider({ children, id: prefixId, locale: _locale, }: {
    children?: ReactNode;
    id?: string;
    locale?: string;
}): Promise<import("react/jsx-runtime").JSX.Element>;
//# sourceMappingURL=GTProvider.d.ts.map