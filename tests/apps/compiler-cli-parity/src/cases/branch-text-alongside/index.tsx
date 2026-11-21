import { Select } from 'gt-react';

export default function BranchTextAlongside() {
  return (
    <div>
      Results: <Select value={'view' as string} list="List view" grid="Grid view">Default view</Select>
    </div>
  );
}
