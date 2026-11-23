import { Select, Plural } from 'gt-react';

export default function BranchPluralSiblings() {
  const count = 3;
  return (
    <div>
      Label: <Select value="x">fallback</Select>
      <Plural n={count} one="one">many</Plural>
    </div>
  );
}
