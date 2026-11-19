import { Branch } from 'gt-react';

export default function BranchDataAttributes() {
  const val = 'dynamic';
  return (
    <div>
      <Branch branch={'x' as string} hello={val} world="static">Fallback</Branch>
    </div>
  );
}
