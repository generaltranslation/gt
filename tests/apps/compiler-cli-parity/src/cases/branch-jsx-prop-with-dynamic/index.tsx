import { Branch } from 'gt-react';

export default function BranchJsxPropWithDynamic() {
  const userName = 'Alice';
  return (
    <div>
      <Branch branch="mode" greeting={<>Hello {userName}</>}>
        Fallback
      </Branch>
    </div>
  );
}
