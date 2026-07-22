import { useState } from 'react';
import { Link } from 'react-router';
import { LocaleSelector, Num, T, Var, useLocale } from 'gt-react';
import type { Route } from './+types/home';
import { HtmlLangSync } from '../components/HtmlLangSync';

export function meta(_args: Route.MetaArgs) {
  return [
    { title: 'gt-react + React Router SPA' },
    {
      name: 'description',
      content: 'gt-react running inside a React Router v7 single-page app.',
    },
  ];
}

export default function Home() {
  const locale = useLocale();
  const [count, setCount] = useState(0);

  return (
    <main className='page'>
      <HtmlLangSync />
      <section className='panel'>
        <p className='eyebrow'>{t`Home`}</p>

        <T>
          <h1>Ship your app in every language</h1>
          <p>
            This is a React Router v7 single-page app. gt-react initializes once
            in the browser, then translates this content with no provider
            component.
          </p>
        </T>

        <button
          type='button'
          className='counter'
          onClick={() => setCount((current) => current + 1)}
        >
          <T>
            Clicked <Num>{count}</Num> times
          </T>
        </button>

        <p className='locale'>
          <T>
            Active locale: <Var>{locale}</Var>
          </T>
        </p>

        <div className='controls'>
          <LocaleSelector />
          <Link className='link' to='/about'>
            {t`About this example`}
          </Link>
        </div>
      </section>
    </main>
  );
}
