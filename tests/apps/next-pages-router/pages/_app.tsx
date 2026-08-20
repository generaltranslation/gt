import type { AppProps } from 'next/app';
import Router from 'next/router';
import { GTProvider, WithGTServerSideProps } from 'gt-next';
import '../styles/globals.css';

export default function App({
  Component,
  pageProps,
}: AppProps<WithGTServerSideProps>) {
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
