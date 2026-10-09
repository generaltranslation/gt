import type { ReactNode } from 'react';
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router';
import { LocaleSelector, useLocale } from 'gt-tanstack-start';
import '../styles.css';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'gt-tanstack-start Rendering Modes Test' },
      {
        name: 'description',
        content:
          'A test bed for gt-tanstack-start across TanStack Start rendering modes.',
      },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <div className='app-shell'>
        <header className='topbar'>
          <div className='brand'>
            <strong>gt-tanstack-start</strong>
            <span>Rendering mode test bed</span>
          </div>
          <nav className='nav'>
            <Link to='/'>Home</Link>
            <Link to='/ssr'>SSR</Link>
            <Link to='/spa'>SPA</Link>
            <Link to='/data-only'>Data only</Link>
          </nav>
          <LocaleSelector />
        </header>
        <Outlet />
      </div>
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
