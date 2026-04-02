import { Branch } from 'gt-react';

export default function BranchTextAlongside() {
  return (
    <div>
      Results: <Branch branch="view" list="List view" grid="Grid view">Default view</Branch>
    </div>
  );
}
