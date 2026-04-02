import { Branch } from 'gt-react';

export default function BranchWithJsxProps() {
  return (
    <div>
      <Branch branch="x" a={<span>Option A</span>} b={<p>Option B</p>}>
        Default
      </Branch>
    </div>
  );
}
