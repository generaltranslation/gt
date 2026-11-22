import type { ReactNode } from 'react';
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router';
import { useGT, useLocale } from 'gt-tanstack-start';

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
        <Link to='/' data-link='/' data-m data-src='Start'>
          {t`Start`}
        </Link>
        <Link to='/panel' data-link='/panel' data-m data-src='Notice board'>
          {t`Notice board`}
        </Link>
        <Link to='/card' data-link='/card' data-m data-src='Membership card'>
          {t`Membership card`}
        </Link>
      </nav>
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
