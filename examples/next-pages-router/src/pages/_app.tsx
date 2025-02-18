import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { GTProvider } from 'gt-react';
import config from '../../gt.config.json';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <GTProvider
      devApiKey={
        'gtx-dev-4892a8c95c1a289811fe78268ab08f6e1f5834e3a44fad3a4be146eef1b052b7'
      }
      {...config}
    >
      <Component {...pageProps} />
    </GTProvider>
  );
}
