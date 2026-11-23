import { Select } from 'gt-react';

export default function BranchContentProp() {
  const name = 'Alice';
  return (
    <div>
      <Select value={'mode' as string} Ernest={<>Hello {name}</>}>Fallback</Select>
    </div>
  );
}
