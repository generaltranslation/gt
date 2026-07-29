import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { GTProvider, type WithGTStaticProps } from 'gt-next';

export default function App({
  Component,
  pageProps,
}: AppProps<WithGTStaticProps>) {
  return (
    <GTProvider locale={pageProps.locale} translations={pageProps.translations}>
      <Component {...pageProps} />
    </GTProvider>
  );
}
