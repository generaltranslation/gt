import type { GetStaticPaths } from 'next';
import { useRouter } from 'next/router';
import { LocaleSelector, useLocale, withGTStaticProps } from 'gt-next';

export const getStaticProps = withGTStaticProps();

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: [],
  fallback: 'blocking',
});

export default function CatalogPage() {
  const router = useRouter();
  const locale = useLocale();

  return (
    <main>
      <p>Client locale: {locale}</p>
      <LocaleSelector />
      <pre data-testid='router-query'>{JSON.stringify(router.query)}</pre>
    </main>
  );
}
