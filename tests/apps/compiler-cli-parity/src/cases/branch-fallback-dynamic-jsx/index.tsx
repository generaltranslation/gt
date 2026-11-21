import { Select } from 'gt-react';

export default function BranchFallbackDynamicJsx() {
  const name = 'Alice';
  return (
    <div>
      <Select value="x">
        <p>Fallback {name}</p>
      </Select>
    </div>
  );
}
