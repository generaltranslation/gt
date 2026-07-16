import type { GetServerSideProps } from 'next';
import {
  LocaleSelector,
  T,
  useGT,
  useLocale,
  withGTServerSideProps,
} from 'gt-next';

type HomeProps = {
  renderedAt: string;
  cookieLocale: string;
};

export const getServerSideProps: GetServerSideProps<HomeProps> =
  withGTServerSideProps(async (context) => {
    return {
      props: {
        renderedAt: new Date().toISOString(),
        cookieLocale: context.req.cookies['generaltranslation.locale'] ?? 'en',
      },
    };
  });

export default function Home({ renderedAt, cookieLocale }: HomeProps) {
  const gt = useGT();
  const locale = useLocale();

  return (
    <main className='page'>
      <section className='panel'>
        <p className='label'>Next.js Pages Router</p>
        <h1>gt-next pages SSR test</h1>
        <div className='meta'>
          <span>Client locale: {locale}</span>
          <span>Cookie locale (SSR): {cookieLocale}</span>
          <span>Rendered: {renderedAt}</span>
        </div>
      </section>

      <section className='panel'>
        <p className='label'>gt-next client entry</p>
        <LocaleSelector />
        <T>
          <p>This paragraph is translated via gt-next in the Pages Router.</p>
        </T>
        <p>{gt('A string translated with useGT from gt-next.')}</p>
      </section>
    </main>
  );
}
