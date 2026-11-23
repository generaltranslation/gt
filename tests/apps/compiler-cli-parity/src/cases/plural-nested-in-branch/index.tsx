import { Select, Plural } from 'gt-react';

export default function PluralNestedInBranch() {
  const n = 3;
  return (
    <div>
      <Select value={'x' as string} a={<Plural n={n} one="one item">many items</Plural>}>Default</Select>
    </div>
  );
}
