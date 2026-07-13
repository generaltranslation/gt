import type { GetStaticProps, GetStaticPropsContext, PreviewData } from 'next';
import type { ParsedUrlQuery } from 'querystring';
import { getI18nConfig } from '@generaltranslation/react-core/pure';
import { getTranslationsSnapshot } from 'gt-react';

type TranslationsSnapshot = Awaited<ReturnType<typeof getTranslationsSnapshot>>;

type GTStaticProps = {
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
    const snapshots = await Promise.all(
      getI18nConfig()
        .getLocales()
        .map((locale) => getTranslationsSnapshot(locale))
    );
    const translations = snapshots.reduce<TranslationsSnapshot>(
      (allTranslations, snapshot) => ({
        ...allTranslations,
        ...snapshot,
      }),
      {}
    );

    return {
      ...result,
      props: {
        ...props,
        translations,
      },
    };
  };
}

export type WithGTStaticPropsFunction = typeof withGTStaticProps;
