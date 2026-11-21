import { Select } from 'gt-react';

export default function BranchFallbackDynamic() {
  const name = 'Alice';
  return (
    <div>
      <Select value={name}>
        Fallback with {name}
      </Select>
    </div>
  );
}
