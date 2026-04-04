import { Branch } from 'gt-react';

export default function BranchTernaryInProp() {
  const flag = true;
  return (
    <div>
      <Branch branch="mode" summary={flag ? <p>Option A</p> : <p>Option B</p>}>
        Fallback
      </Branch>
    </div>
  );
}
