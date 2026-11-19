import { N, Plural } from 'gt-react';

export default function PluralCount() {
  const count = 3;
  return (
    <div>
      <Plural n={count} one="One file"><b><N /></b> files</Plural>
    </div>
  );
}
