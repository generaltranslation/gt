import type { ReactNode } from 'react';
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router';
import { LocaleSelector, useGT, useLocale } from 'gt-tanstack-start';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    ],
  }),
  component: RootComponent,
});

// Every message of the app is in an element with `data-m`, whose `data-src`
// is what the source locale renders: scripts/check.mjs compares the two.
function RootComponent() {
  const t = useGT();
  return (
    <RootDocument>
      <nav data-nav>
        <Link to='/' data-link='/' data-m data-src='Home'>
          {t`Home`}
        </Link>
        <Link to='/reports' data-link='/reports' data-m data-src='Reports'>
          {t`Reports`}
        </Link>
        <Link to='/settings' data-link='/settings' data-m data-src='Settings'>
          {t`Settings`}
        </Link>
        <Link
          to='/client-only'
          data-link='/client-only'
          data-m
          data-src='Rendered in the browser'
        >
          {t`Rendered in the browser`}
        </Link>
        <Link
          to='/data-only'
          data-link='/data-only'
          data-m
          data-src='Loaded on the server'
        >
          {t`Loaded on the server`}
        </Link>
        <Link
          to='/deferred'
          data-link='/deferred'
          data-m
          data-src='Streamed later'
        >
          {t`Streamed later`}
        </Link>
      </nav>
      <LocaleSelector />
      <Outlet />
    </RootDocument>
  );
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
