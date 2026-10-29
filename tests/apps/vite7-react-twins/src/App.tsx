import { lazy, Suspense } from 'react';
import { LocaleSelector, T, useLocale } from 'gt-react';
import { HomePage } from './pages/HomePage';
import { onLinkClick, usePathname } from './router';

// The harbor guide page is a lazy route: its strings ship in its own twin.
const HarborGuidePage = lazy(() =>
  import('./pages/HarborGuidePage').then((module) => ({
    default: module.HarborGuidePage,
  }))
);

export function App() {
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <main className='page'>
      <section className='panel'>
        <T>
          <h1>Lighthouse Atlas</h1>
        </T>
        <div className='meta'>
          <span data-testid='locale'>Locale: {locale}</span>
        </div>
        <nav className='meta'>
          <a href='/' onClick={onLinkClick}>
            <T>Front page of the atlas</T>
          </a>
          <a href='/harbor-guide' onClick={onLinkClick}>
            <T>Open the harbor guide</T>
          </a>
        </nav>
        <LocaleSelector />
      </section>
      {pathname === '/harbor-guide' ? (
        <Suspense fallback={<p>…</p>}>
          <HarborGuidePage />
        </Suspense>
      ) : (
        <HomePage />
      )}
    </main>
  );
}
