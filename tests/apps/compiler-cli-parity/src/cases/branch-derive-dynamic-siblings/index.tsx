import { Derive, Branch } from 'gt-react';

function getX() {
  return 'derived';
}

export default function BranchDeriveDynamicSiblings() {
  const z = 'dynamic';
  return (
    <div>
      Hello <Derive>{getX()}</Derive>, <Branch branch="y">fallback</Branch> and {z}
    </div>
  );
}
