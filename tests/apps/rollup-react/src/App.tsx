import { LocaleSelector, T, Var, t, useLocale } from 'gt-react';

function Demo() {
  const locale = useLocale();

  return (
    <main className='page'>
      <section className='panel'>
        <p className='label'>Rollup + React (SPA)</p>
        <h1>gt-react client-side test</h1>
        <div className='meta'>
          <span>Locale: {locale}</span>
        </div>
        <LocaleSelector />
      </section>

      <section className='panel'>
        <p className='label'>GT smoke test</p>
        <T>
          <p>
            This paragraph is translated client-side, with a runtime value:{' '}
            <Var>{String(new Date().getFullYear())}</Var>
          </p>
        </T>
        <p>{t('A string translated with useGT.')}</p>
      </section>
    </main>
  );
}

export function App() {
  return <Demo />;
}
