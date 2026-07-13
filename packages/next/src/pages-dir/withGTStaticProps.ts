import type { GetStaticProps, GetStaticPropsContext, PreviewData } from 'next';
import type { ParsedUrlQuery } from 'querystring';
import { getI18nConfig } from '@generaltranslation/react-core/pure';
import { getTranslationsSnapshot } from 'gt-react';

type TranslationsSnapshot = Awaited<ReturnType<typeof getTranslationsSnapshot>>;

type GTStaticProps = {
  locale: string;
  translations: TranslationsSnapshot;
};

export type WithGTStaticProps<
  Props extends Record<string, unknown> = Record<string, unknown>,
> = Props & GTStaticProps;

export function withGTStaticProps<
  Props extends Record<string, unknown> = Record<string, unknown>,
  Params extends ParsedUrlQuery = ParsedUrlQuery,
  Preview extends PreviewData = PreviewData,
>(
  getStaticProps?: GetStaticProps<Props, Params, Preview>
): GetStaticProps<WithGTStaticProps<Props>, Params, Preview> {
  return async (context: GetStaticPropsContext<Params, Preview>) => {
    const result = getStaticProps
      ? await getStaticProps(context)
      : { props: {} as Props };

    if (!('props' in result)) {
      return result;
    }

    const props = await result.props;
    const i18nConfig = getI18nConfig();
    const defaultLocale = i18nConfig.getDefaultLocale();
    const locale = context.locale || context.defaultLocale || defaultLocale;
    const translations =
      locale === defaultLocale ? {} : await getTranslationsSnapshot(locale);

    return {
      ...result,
      props: {
        ...props,
        locale,
        translations,
      },
    };
  };
}

export type WithGTStaticPropsFunction = typeof withGTStaticProps;
