import { ReactNode } from 'react';
/**
 * Provides General Translation context to its children, which can then access `useGT`, `useLocale`, and `useDefaultLocale`.
 *
 * @param {React.ReactNode} children - The children components that will use the translation context.
 * @param {string} id - ID of a nested dictionary, so that only a subset of a large dictionary needs to be sent to the client.
 *
 * @returns {JSX.Element} The provider component for General Translation context.
 */
export default function GTProvider({
  children,
  id,
}: {
  children?: ReactNode;
  id?: string;
}): Promise<import('react/jsx-runtime').JSX.Element>;
//# sourceMappingURL=GTProvider.d.ts.map
