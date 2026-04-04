import { Branch, Plural } from 'gt-react';

export default function BranchPluralSiblings() {
  const count = 3;
  return (
    <div>
      Label: <Branch branch="x">fallback</Branch>
      <Plural n={count} one="one" other="many" />
    </div>
  );
}
