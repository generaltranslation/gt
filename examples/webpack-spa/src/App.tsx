import { LocaleSelector, T, Var, t, useLocale } from 'gt-react';

// A module-level t() call. It resolves because src/index.ts awaits
// initializeGTSPA before this module is imported.
const tagline = t('Runtime i18n, bundled by webpack.');

function Demo() {
  const locale = useLocale();
  const year = new Date().getFullYear();

  return (
    <main className='page'>
      <section className='panel'>
        <p className='label'>webpack + React (SPA)</p>
        <h1>
          <T>Ship your React app in every language</T>
        </h1>
        <p className='lede'>
          <T>
            This single-page app is internationalized with gt-react and bundled
            by webpack. Translations load in the browser at startup, so there is
            no provider and no server.
          </T>
        </p>
        <div className='controls'>
          <span className='active-locale'>Active locale: {locale}</span>
          <LocaleSelector />
        </div>
      </section>

      <section className='panel'>
        <p className='label'>What this shows</p>
        <ul className='features'>
          <li>
            <T>Wrap any text in the T component to translate it.</T>
          </li>
          <li>
            <T>Switch languages with the built-in locale selector.</T>
          </li>
          <li>
            <T>
              Preview live translations while developing with the GT compiler.
            </T>
          </li>
        </ul>
        <T>
          <p className='runtime'>
            Rendered with a live value. The current year is <Var>{year}</Var>
          </p>
        </T>
        <p className='tagline'>{tagline}</p>
      </section>
    </main>
  );
}

export function App() {
  return <Demo />;
}
