import type { GetStaticProps, GetStaticPropsContext, PreviewData } from 'next';
import type { ParsedUrlQuery } from 'querystring';
import { getI18nConfig } from 'gt-i18n/internal';
import { getTranslationsSnapshot } from 'gt-react';
import type { WithGTServerSideProps } from './withGTServerSideProps';

export function withGTStaticProps<
  Props extends Record<string, unknown> = Record<string, unknown>,
  Params extends ParsedUrlQuery = ParsedUrlQuery,
  Preview extends PreviewData = PreviewData,
>(
  getStaticProps?: GetStaticProps<Props, Params, Preview>
): GetStaticProps<WithGTServerSideProps<Props>, Params, Preview>;

export function withGTStaticProps<
  Props extends Record<string, unknown> = Record<string, unknown>,
  Params extends ParsedUrlQuery = ParsedUrlQuery,
  Preview extends PreviewData = PreviewData,
>(
  locale: string,
  getStaticProps?: GetStaticProps<Props, Params, Preview>
): GetStaticProps<WithGTServerSideProps<Props>, Params, Preview>;

export function withGTStaticProps<
  Props extends Record<string, unknown> = Record<string, unknown>,
  Params extends ParsedUrlQuery = ParsedUrlQuery,
  Preview extends PreviewData = PreviewData,
>(
  firstArg?: string | GetStaticProps<Props, Params, Preview>,
  secondArg?: GetStaticProps<Props, Params, Preview>
): GetStaticProps<WithGTServerSideProps<Props>, Params, Preview> {
  const localeArg = typeof firstArg === 'string' ? firstArg : undefined;
  const getStaticProps = typeof firstArg === 'function' ? firstArg : secondArg;

  return async (context: GetStaticPropsContext<Params, Preview>) => {
    const result = getStaticProps
      ? await getStaticProps(context)
      : { props: {} as Props };

    if (!('props' in result)) {
      return result;
    }

    const props = await result.props;
    const locale =
      localeArg ||
      context.locale ||
      context.defaultLocale ||
      getI18nConfig().getDefaultLocale();

    return {
      ...result,
      props: {
        ...props,
        locale,
        translations: await getTranslationsSnapshot(locale),
      },
    };
  };
}
