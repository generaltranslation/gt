import { Derive, Select } from 'gt-react';

function getX() {
  return 'derived';
}

export default function BranchDeriveDynamicSiblings() {
  const z = 'dynamic';
  return (
    <div>
      Hello <Derive>{getX()}</Derive>, <Select value="y">fallback</Select> and {z}
    </div>
  );
}
