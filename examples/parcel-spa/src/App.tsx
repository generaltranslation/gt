import { useState } from 'react';
import { LocaleSelector, Num, T, t } from 'gt-react';

// A module-level string translated with t(). Because initializeGTSPA() runs and
// resolves before this module is imported, t() has its translations ready here.
const tagline = t('Ship your product in every language.');

function App() {
  const [count, setCount] = useState(0);

  return (
    <main className='page'>
      <T>
        <section className='hero'>
          <p className='eyebrow'>gt-react + Parcel</p>
          <h1>Hello from the General Translation SPA example</h1>
          <p>
            This interface is translated at build time by the GT compiler,
            running through a native Parcel transformer.
          </p>
        </section>
      </T>

      <p className='tagline'>{tagline}</p>

      <button
        type='button'
        className='counter'
        onClick={() => setCount((current) => current + 1)}
      >
        <T>
          Clicked <Num>{count}</Num> times
        </T>
      </button>

      <div className='switcher'>
        <LocaleSelector />
      </div>
    </main>
  );
}

export default App;
