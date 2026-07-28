import { T, LocaleSelector } from 'gt-react';

export default function Welcome() {
  return (
    <main>
      <LocaleSelector />
      <T>
        <h1>Welcome to my app</h1>
        <p>This content will be translated automatically.</p>
      </T>
    </main>
  );
}
