import { Branch, Plural } from 'gt-react';

export default function PluralNestedInBranch() {
  const n = 3;
  return (
    <div>
      <Branch branch={'x' as string} a={<Plural n={n} one="one item">many items</Plural>}>Default</Branch>
    </div>
  );
}
