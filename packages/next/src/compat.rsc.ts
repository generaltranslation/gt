// The dictionary (key-based) API for React Server Components. Initializes GT
// like the root entry it extends.
import { initializeGTServer } from './setup/initGT.server';
initializeGTServer();

import type { GetServerSideProps, PreviewData } from 'next';
import type { ParsedUrlQuery } from 'querystring';
import type {
  WithGTServerSideProps,
  WithGTStaticPropsFunction,
} from './compat/pages';
import { withGTStaticPropsRscError } from './errors/createErrors';

export { GTProvider } from './compat/GTProvider';
export type { GTProviderProps } from './utils/types';

export function withGTServerSideProps<
  Props extends Record<string, unknown> = Record<string, unknown>,
  Params extends ParsedUrlQuery = ParsedUrlQuery,
  Preview extends PreviewData = PreviewData,
>(
  _?: GetServerSideProps<Props, Params, Preview>
): GetServerSideProps<WithGTServerSideProps<Props>, Params, Preview> {
  throw new Error(
    'withGTServerSideProps() is only available for the Pages Router.'
  );
}

export const withGTStaticProps: WithGTStaticPropsFunction = () => {
  throw new Error(withGTStaticPropsRscError);
};

export type { WithGTServerSideProps, WithGTStaticProps } from './compat/pages';
export { useTranslations } from './compat/getTranslations';
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
