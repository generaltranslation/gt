import * as React from 'react'
import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { GTProvider } from 'gt-react';
import gtConfig from '../../gt.config.json';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <GTProvider {...gtConfig}>
        <Component {...pageProps} />
      </GTProvider>
    </>
  );
}
