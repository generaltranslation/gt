import type { AppProps } from 'next/app';
import { GTProvider, WithGTServerSideProps } from 'gt-next';
import '../styles/globals.css';

export default function App({
  Component,
  pageProps,
}: AppProps<WithGTServerSideProps>) {
  const { locale, translations, ...restPageProps } = pageProps;

  return (
    <GTProvider locale={locale} translations={translations}>
      <Component {...restPageProps} />
    </GTProvider>
  );
}
