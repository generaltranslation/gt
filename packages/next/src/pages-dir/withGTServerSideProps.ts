import type {
  GetServerSideProps,
  GetServerSidePropsContext,
  PreviewData,
} from 'next';
import type { ParsedUrlQuery } from 'querystring';
import { getTranslationsSnapshot } from 'gt-react';
import { parseLocale } from './parseLocale';
import { parseEnableI18n } from './parseEnableI18n';

type GTServerSideProps = {
  locale: string;
  enableI18n: boolean;
  translations: Awaited<ReturnType<typeof getTranslationsSnapshot>>;
};

export type WithGTServerSideProps<
  Props extends Record<string, unknown> = Record<string, unknown>,
> = Props & GTServerSideProps;

export function withGTServerSideProps<
  Props extends Record<string, unknown> = Record<string, unknown>,
  Params extends ParsedUrlQuery = ParsedUrlQuery,
  Preview extends PreviewData = PreviewData,
>(
  getServerSideProps?: GetServerSideProps<Props, Params, Preview>
): GetServerSideProps<WithGTServerSideProps<Props>, Params, Preview> {
  return async (context: GetServerSidePropsContext<Params, Preview>) => {
    const result = getServerSideProps
      ? await getServerSideProps(context)
      : { props: {} as Props };

    if (!('props' in result)) {
      return result;
    }

    const props = await result.props;
    const locale = parseLocale(context);
    const enableI18n = parseEnableI18n(context);

    return {
      props: {
        ...props,
        locale,
        enableI18n,
        translations: await getTranslationsSnapshot(locale),
      },
    };
  };
}
