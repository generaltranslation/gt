import { Branch } from 'gt-react';

export default function BranchFallbackDynamicJsx() {
  const name = 'Alice';
  return (
    <div>
      <Branch branch="x">
        <p>Fallback {name}</p>
      </Branch>
    </div>
  );
}
