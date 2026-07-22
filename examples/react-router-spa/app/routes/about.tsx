import { Link } from 'react-router';
import { LocaleSelector, T } from 'gt-react';
import type { Route } from './+types/about';
import { moduleLevelHeading } from '../messages';
import { HtmlLangSync } from '../components/HtmlLangSync';

export function meta(_args: Route.MetaArgs) {
  return [{ title: 'About - gt-react + React Router SPA' }];
}

export default function About() {
  return (
    <main className='page'>
      <HtmlLangSync />
      <section className='panel'>
        <T>
          <h1>About this example</h1>
          <p>
            gt-react initializes once at startup. Because initialization
            finishes before any route module loads in the browser, calling t()
            at the top level of a module resolves correctly.
          </p>
        </T>

        <p className='lead'>{moduleLevelHeading}</p>

        <T>
          <p>
            Switching the locale reloads the page, so gt-react reinitializes
            with the new language and re-resolves every string, including the
            module-level one above.
          </p>
        </T>

        <div className='controls'>
          <LocaleSelector />
          <Link className='link' to='/'>
            {t`Back home`}
          </Link>
        </div>
      </section>
    </main>
  );
}
