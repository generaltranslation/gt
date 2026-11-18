import { Branch } from 'gt-react';

export default function BranchWithJsxProps() {
  return (
    <div>
      <Branch branch={'x' as string} a={<span>Option A</span>} b={<p>Option B</p>}>Default</Branch>
    </div>
  );
}
