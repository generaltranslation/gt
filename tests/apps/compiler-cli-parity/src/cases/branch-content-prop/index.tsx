import { Branch } from 'gt-react';

export default function BranchContentProp() {
  const name = 'Alice';
  return (
    <div>
      <Branch branch="mode" Ernest={<>Hello {name}</>}>
        Fallback
      </Branch>
    </div>
  );
}
