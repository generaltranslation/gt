import { Select } from 'gt-react';

export default function BranchWithJsxProps() {
  return (
    <div>
      <Select value={'x' as string} a={<span>Option A</span>} b={<p>Option B</p>}>Default</Select>
    </div>
  );
}
