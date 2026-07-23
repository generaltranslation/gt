import { LocaleSelector, T, useLocale } from 'gt-react';
import { kicker } from './copy';

function App() {
  const locale = useLocale();

  return (
    <main className='page'>
      <header className='topbar'>
        <span className='wordmark'>gt-react</span>
        <LocaleSelector />
      </header>

      <section className='hero'>
        <p className='eyebrow'>{kicker}</p>
        <T>
          <h1>Translate your React app at runtime</h1>
        </T>
        <T>
          <p>
            This single-page app is bundled by Rsbuild and internationalized
            with General Translation.
          </p>
        </T>
      </section>

      <section className='card'>
        <T>
          <p>
            Pick a language above. The whole page re-renders in the selected
            locale, with no provider and no server.
          </p>
        </T>
        <p className='locale'>
          <span className='locale-label'>Active locale</span>
          <code>{locale}</code>
        </p>
      </section>
    </main>
  );
}

export default App;
