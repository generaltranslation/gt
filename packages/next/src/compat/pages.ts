import type { GetServerSideProps, GetStaticProps, PreviewData } from 'next';
import type { ParsedUrlQuery } from 'querystring';
import {
  withGTServerSideProps as withGTServerSidePropsRoot,
  type WithGTServerSideProps as WithGTServerSidePropsRoot,
} from '../pages-dir/withGTServerSideProps';
import {
  withGTStaticProps as withGTStaticPropsRoot,
  type WithGTStaticProps as WithGTStaticPropsRoot,
} from '../pages-dir/withGTStaticProps';
import { loadDictionaries } from './dictionaries';

type GTDictionaryProps = {
  dictionaries: Awaited<ReturnType<typeof loadDictionaries>>;
};

export type WithGTServerSideProps<
  Props extends Record<string, unknown> = Record<string, unknown>,
> = WithGTServerSidePropsRoot<Props> & GTDictionaryProps;

export type WithGTStaticProps<
  Props extends Record<string, unknown> = Record<string, unknown>,
> = WithGTStaticPropsRoot<Props> & GTDictionaryProps;

/**
 * Wraps a Pages Router `getServerSideProps` function and adds the resolved GT
 * locale, its translations, and its dictionaries to page props.
 */
export function withGTServerSideProps<
  Props extends Record<string, unknown> = Record<string, unknown>,
  Params extends ParsedUrlQuery = ParsedUrlQuery,
  Preview extends PreviewData = PreviewData,
>(
  getServerSideProps?: GetServerSideProps<Props, Params, Preview>
): GetServerSideProps<WithGTServerSideProps<Props>, Params, Preview> {
  const withTranslations = withGTServerSidePropsRoot(getServerSideProps);
  return async (context) => {
    const result = await withTranslations(context);
    if (!('props' in result)) return result;
    const props = await result.props;
    return {
      ...result,
      props: { ...props, dictionaries: await loadDictionaries(props.locale) },
    };
  };
}

/**
 * Wraps a Pages Router `getStaticProps` function and adds the generated
 * locale, its translations, and its dictionaries to page props.
 */
export function withGTStaticProps<
  Props extends Record<string, unknown> = Record<string, unknown>,
  Params extends ParsedUrlQuery = ParsedUrlQuery,
  Preview extends PreviewData = PreviewData,
>(
  getStaticProps?: GetStaticProps<Props, Params, Preview>
): GetStaticProps<WithGTStaticProps<Props>, Params, Preview> {
  const withTranslations = withGTStaticPropsRoot(getStaticProps);
  return async (context) => {
    const result = await withTranslations(context);
    if (!('props' in result)) return result;
    return {
      ...result,
      props: {
        ...result.props,
        dictionaries: await loadDictionaries(result.props.locale),
      },
    };
  };
}

export type WithGTStaticPropsFunction = typeof withGTStaticProps;
