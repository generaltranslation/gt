import { Branch, Plural } from 'gt-react';

export default function BranchInsidePlural() {
  const count = 3;
  return (
    <div>
      <Plural n={count} other={<Branch branch="x" other="fallback" />} />
    </div>
  );
}
