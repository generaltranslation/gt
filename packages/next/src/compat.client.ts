'use client';

// The dictionary (key-based) API for the browser. Initializes GT like the
// root entry it extends.
import { initializeGTClient } from './setup/initGT.client';
initializeGTClient();

import type { GetServerSideProps, PreviewData } from 'next';
import type { ParsedUrlQuery } from 'querystring';
import type {
  WithGTServerSideProps,
  WithGTStaticPropsFunction,
} from './compat/pages';
import { createWithGTStaticPropsClientError } from './errors/client';

export { GTProvider, type GTProviderProps } from 'gt-react/compat';

export function withGTServerSideProps<
  Props extends Record<string, unknown> = Record<string, unknown>,
  Params extends ParsedUrlQuery = ParsedUrlQuery,
  Preview extends PreviewData = PreviewData,
>(
  _?: GetServerSideProps<Props, Params, Preview>
): GetServerSideProps<WithGTServerSideProps<Props>, Params, Preview> {
  throw new Error(
    'withGTServerSideProps() is only available from gt-next/compat on the server.'
  );
}

export const withGTStaticProps: WithGTStaticPropsFunction = () => {
  throw new Error(createWithGTStaticPropsClientError());
};

export type { WithGTServerSideProps, WithGTStaticProps } from './compat/pages';
export { useTranslations } from 'gt-react/compat';
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
