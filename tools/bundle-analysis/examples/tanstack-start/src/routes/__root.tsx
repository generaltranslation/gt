import type { ReactNode } from 'react';
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router';
import {
  getTranslationsSnapshot,
  GTProvider,
  LocaleSelector,
  parseLocale,
  useGT,
} from 'gt-tanstack-start';
import { GtMark } from '../components/GtMark';
import '../styles.css';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    ],
  }),
  component: RootComponent,
  loader: async () => {
    const locale = parseLocale();
    return {
      locale,
      translations: await getTranslationsSnapshot(locale),
    };
  },
});

function RootComponent() {
  const { locale, translations } = Route.useLoaderData();
  return (
    <RootDocument locale={locale}>
      <GTProvider locale={locale} translations={translations}>
        <div className='gt-frame'>
          <Nav />
          <Outlet />
        </div>
      </GTProvider>
    </RootDocument>
  );
}

function Nav() {
  const gt = useGT();
  return (
    <header className='gt-nav'>
      <div className='nav-start'>
        <Link className='gt-mark' to='/' aria-label='Ferro'>
          <GtMark />
          <span>Ferro</span>
        </Link>
        <nav className='nav-links' aria-label={gt('Pages')}>
          <Link to='/' activeOptions={{ exact: true }}>
            {gt('Overview')}
          </Link>
          <Link to='/specs'>{gt('Specs')}</Link>
        </nav>
      </div>
      <LocaleSelector className='locale-select' />
      <span className='gt-cross bl' />
      <span className='gt-cross br' />
    </header>
  );
}

function RootDocument({
  locale,
  children,
}: Readonly<{ locale: string; children: ReactNode }>) {
  return (
    <html lang={locale}>
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
