import type { ReactNode } from 'react';
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router';
import { LocaleSelector, T, useLocale } from 'gt-tanstack-start';
import '../styles.css';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'gt-tanstack-start locale twins' },
    ],
  }),
  component: RootComponent,
});

// Locale twins: no translations snapshot. The server renders from the locale
// it loaded for the request; the browser renders from the locale's twins.
function RootComponent() {
  return (
    <RootDocument>
      <main className='page'>
        <section className='panel'>
          <T>
            <h1>Lighthouse Atlas</h1>
          </T>
          <div className='meta'>
            <LocaleMarker />
          </div>
          <nav className='meta'>
            <Link to='/'>
              <T>Front page of the atlas</T>
            </Link>
            <Link to='/harbor-guide'>
              <T>Open the harbor guide</T>
            </Link>
            <Link to='/signal-log'>
              <T>Read the signal log</T>
            </Link>
            <Link to='/harbor-notices'>
              <T>Read the harbor notices</T>
            </Link>
          </nav>
          <LocaleSelector />
        </section>
        <Outlet />
      </main>
    </RootDocument>
  );
}

function LocaleMarker() {
  const locale = useLocale();
  return <span data-testid='locale'>Locale: {locale}</span>;
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang={useLocale()}>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
