import { Branch } from 'gt-react';

export default function BranchTernaryInProp() {
  const flag = true;
  return (
    <div>
      <Branch branch={'mode' as string} summary={flag ? <p>Option A</p> : <p>Option B</p>} other="Fallback" />
    </div>
  );
}
