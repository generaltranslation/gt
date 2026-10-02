import {
  HeadContent,
  Link,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router';
import {
  GTProvider,
  getLocale,
  getTranslationsSnapshot,
  LocaleSelector,
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
  loader: async () => {
    const locale = getLocale();
    return {
      locale,
      translations: await getTranslationsSnapshot(locale),
    };
  },
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  const { locale, translations } = Route.useLoaderData();
  return (
    <html lang={locale}>
      <head>
        <HeadContent />
      </head>
      <body>
        <GTProvider locale={locale} translations={translations}>
          <div className='gt-frame'>
            <Nav />
            {children}
          </div>
        </GTProvider>
        <Scripts />
      </body>
    </html>
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
