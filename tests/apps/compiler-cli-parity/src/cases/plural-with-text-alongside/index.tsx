import { Plural } from 'gt-react';

export default function PluralWithTextAlongside() {
  const n = 3;
  return (
    <div>
      You have <Plural n={n} one="one notification">many notifications</Plural> today.
    </div>
  );
}
