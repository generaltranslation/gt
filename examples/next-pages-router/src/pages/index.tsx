import { LocaleSelector } from 'gt-react';
import { T } from 'gt-react';

export default function Home() {
  return (
    <div>
      <T id='pages.index.0'>
        <div>Hello, world!</div>
        <LocaleSelector />
      </T>
    </div>
  );
}
