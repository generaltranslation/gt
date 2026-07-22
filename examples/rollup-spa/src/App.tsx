import { LocaleSelector, T, Var, useLocale } from 'gt-react';

// A module-level t`...` string, using the global macro that src/index.ts
// attaches via `import 'gt-react/macros'`. This is allowed in an SPA (it is
// only forbidden in server-rendered apps). Switching locales reloads the page,
// so this line re-evaluates with the new locale on every switch.
const tagline = t`Internationalized at build time, translated in the browser.`;

function Demo() {
  const locale = useLocale();

  return (
    <main className='page'>
      <header className='panel'>
        <p className='label'>gt-react + Rollup</p>
        <T>
          <h1>Client-side translations, no framework required</h1>
        </T>
        <p className='tagline'>{tagline}</p>
        <div className='meta'>
          <span>
            Active locale: <strong>{locale}</strong>
          </span>
          <LocaleSelector />
        </div>
      </header>

      <section className='panel'>
        <p className='label'>Runtime translation</p>
        <T>
          <p>
            This paragraph is translated in the browser at runtime. It even
            carries a live value: the current locale is <Var>{locale}</Var>,
            resolved without a single network request.
          </p>
        </T>
      </section>

      <section className='panel'>
        <p className='label'>How it works</p>
        <T>
          <ol className='steps'>
            <li>
              The Rollup compiler plugin extracts every message at build time.
            </li>
            <li>
              Translations ship as static JSON in src/_gt and load on demand.
            </li>
            <li>
              Pick a locale above to swap the strings with zero API calls.
            </li>
          </ol>
        </T>
      </section>
    </main>
  );
}

export function App() {
  return <Demo />;
}
