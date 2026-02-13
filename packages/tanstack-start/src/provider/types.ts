import { GTProviderProps as GTReactProviderProps } from 'gt-react/internal';

/**
 * Props for the GTProvider component
 * @param {React.ReactNode} children - The children components that will use the translation context.
 * @param {Translations} translations - The translations to use for the translation context.
 * @param {string} locale - The locale to use for the translation context.
 *
 * TODO: use Pick<> syntax
 */
export type GTProviderProps = GTReactProviderProps;
