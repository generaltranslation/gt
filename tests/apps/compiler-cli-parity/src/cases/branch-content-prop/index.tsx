import { Branch } from 'gt-react';

export default function BranchContentProp() {
  const name = 'Alice';
  return (
    <div>
      <Branch branch={'mode' as string} Ernest={<>Hello {name}</>}>Fallback</Branch>
    </div>
  );
}
