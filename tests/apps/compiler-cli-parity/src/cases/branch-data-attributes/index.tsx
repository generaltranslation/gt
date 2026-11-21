import { Select } from 'gt-react';

export default function BranchDataAttributes() {
  const val = 'dynamic';
  return (
    <div>
      <Select value={'x' as string} hello={val} world="static">Fallback</Select>
    </div>
  );
}
