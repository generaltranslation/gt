import { Branch, Plural } from 'gt-react';

export default function BranchPluralSiblings() {
  const count = 3;
  return (
    <div>
      Label: <Branch branch="x" other="fallback" />
      <Plural n={count} one="one" other="many" />
    </div>
  );
}
