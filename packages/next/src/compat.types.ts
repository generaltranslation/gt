// Declarations behind the exports map's "types" conditions of gt-next/compat.
// They describe the App Router usage, whichever runtime entry is picked.
import type { ReactNode } from 'react';
import type { GetServerSideProps, PreviewData } from 'next';
import type { ParsedUrlQuery } from 'querystring';
import type { GTProviderProps as ClientGTProviderProps } from 'gt-react/compat';
import { typesFileError } from './errors/createErrors';
import type {
  WithGTServerSideProps,
  WithGTStaticPropsFunction,
} from './compat/pages';

/**
 * GTProvider with the dictionaries `useTranslations()` reads. Render it instead
 * of GTProvider from 'gt-next'. In the App Router it is a server component
 * that loads the translations and dictionaries for the current locale. In the
 * Pages Router, pass it the props from `withGTServerSideProps()` or
 * `withGTStaticProps()` from 'gt-next/compat'.
 *
 * @example
 * // app/layout.tsx
 * <GTProvider>{children}</GTProvider>
 * // pages/_app.tsx
 * <GTProvider {...pageProps}><Component {...pageProps} /></GTProvider>
 */
export function GTProvider(
  _: Partial<ClientGTProviderProps> & { children?: ReactNode }
): ReactNode {
  throw new Error(typesFileError);
}

export type GTProviderProps = Partial<ClientGTProviderProps>;

/**
 * Wraps a Pages Router `getServerSideProps` function and adds the resolved GT
 * locale, its translations, and its dictionaries to page props.
 */
export function withGTServerSideProps<
  Props extends Record<string, unknown> = Record<string, unknown>,
  Params extends ParsedUrlQuery = ParsedUrlQuery,
  Preview extends PreviewData = PreviewData,
>(
  _?: GetServerSideProps<Props, Params, Preview>
): GetServerSideProps<WithGTServerSideProps<Props>, Params, Preview> {
  throw new Error(typesFileError);
}

/**
 * Wraps a Pages Router `getStaticProps` function and adds the generated locale,
 * its translations, and its dictionaries. The default locale's translations
 * snapshot is empty.
 */
export const withGTStaticProps: WithGTStaticPropsFunction = () => {
  throw new Error(typesFileError);
};

export type { WithGTServerSideProps, WithGTStaticProps } from './compat/pages';
export { useTranslations, type UseTranslationsFunction } from 'gt-react/compat';
export type {
  Dictionary,
  DictionaryEntry,
  DictionaryEntryOptions,
  DictionaryKey,
  DictionaryLeaf,
  DictionaryLoader,
  DictionaryObject,
  DictionaryObjectTranslation,
  DictionaryPath,
  DictionaryValue,
} from 'gt-i18n/internal/compat';
