import type {
  GetServerSideProps,
  GetServerSidePropsContext,
  PreviewData,
} from 'next';
import type { ParsedUrlQuery } from 'querystring';
import { getTranslationsSnapshot } from 'gt-react';
import { parseLocale } from './parseLocale';

type GTServerSideProps = {
  locale: string;
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

    return {
      props: {
        ...props,
        locale,
        translations: await getTranslationsSnapshot(locale),
      },
    };
  };
}
