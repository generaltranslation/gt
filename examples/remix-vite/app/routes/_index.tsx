import { useState } from "react";
import { LocaleSelector, Num, T } from "gt-react";

export default function Index() {
  const [count, setCount] = useState(0);

  return (
    <div className="container">
      <div className="logos">
        <a href="https://remix.run" target="_blank" rel="noreferrer">
          <img src="/remix.svg" className="logo" alt="Remix logo" />
        </a>
        <a href="https://react.dev" target="_blank" rel="noreferrer">
          <img src="/react.svg" className="logo react" alt="React logo" />
        </a>
      </div>

      <h1>Remix + gt-react</h1>

      <LocaleSelector />

      <T id="index.content">
        <div className="card">
          <button onClick={() => setCount((c) => c + 1)}>
            count is <Num>{count}</Num>
          </button>
          <p>
            Edit <code>app/routes/_index.tsx</code> and save to test HMR
          </p>
        </div>
        <p className="read-the-docs">
          Click on the Remix and React logos to learn more!
        </p>
      </T>
    </div>
  );
}
