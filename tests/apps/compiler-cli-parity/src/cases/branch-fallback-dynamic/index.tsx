import { Branch } from 'gt-react';

export default function BranchFallbackDynamic() {
  const name = 'Alice';
  return (
    <div>
      <Branch branch={name}>
        Fallback with {name}
      </Branch>
    </div>
  );
}
