import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import Router from 'next/router';
import { GTProvider, type WithGTStaticProps } from 'gt-next';

export default function App({
  Component,
  pageProps,
}: AppProps<WithGTStaticProps>) {
  return (
    <GTProvider
      locale={pageProps.locale}
      translations={pageProps.translations}
      _reload={({ locale }) => {
        void Router.push(Router.pathname, Router.asPath, { locale });
      }}
    >
      <Component {...pageProps} />
    </GTProvider>
  );
}
