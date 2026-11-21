import { Select } from 'gt-react';

export default function BranchTernaryInProp() {
  const flag = true;
  return (
    <div>
      <Select value={'mode' as string} summary={flag ? <p>Option A</p> : <p>Option B</p>}>Fallback</Select>
    </div>
  );
}
