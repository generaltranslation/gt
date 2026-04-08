import { Plural } from 'gt-react';

export default function PluralInParagraph() {
  const n = 3;
  return <p>Count: <Plural n={n} one="one item" other="many items" /></p>;
}
