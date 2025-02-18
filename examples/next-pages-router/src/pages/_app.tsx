import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { GTProvider } from 'gt-react';
import config from '../../gt.config.json';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <GTProvider {...config}>
      <Component {...pageProps} />
    </GTProvider>
  );
}
