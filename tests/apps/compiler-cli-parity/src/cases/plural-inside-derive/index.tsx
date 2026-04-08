import { Derive, Plural } from 'gt-react';

export default function PluralInsideDerive() {
  const count = 3;
  return (
    <div>
      Hello <Derive><Plural n={count} one="item" other="items" /></Derive>
    </div>
  );
}
