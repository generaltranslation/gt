import type { AppProps } from 'next/app';
import { GTProvider, WithGTServerSideProps } from 'gt-next';
import '../styles/globals.css';

export default function App({
  Component,
  pageProps,
}: AppProps<WithGTServerSideProps>) {
  return (
    <GTProvider locale={pageProps.locale} translations={pageProps.translations}>
      <Component {...pageProps} />
    </GTProvider>
  );
}
