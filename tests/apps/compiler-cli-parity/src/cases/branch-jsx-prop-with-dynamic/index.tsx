import { Select } from 'gt-react';

export default function BranchJsxPropWithDynamic() {
  const userName = 'Alice';
  return (
    <div>
      <Select value={'mode' as string} greeting={<>Hello {userName}</>}>Fallback</Select>
    </div>
  );
}
