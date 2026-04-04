import { Branch } from 'gt-react';

export default function BranchDynamicPropValue() {
  const count = 42;
  return (
    <div>
      <Branch branch="hello" hello={count} />
    </div>
  );
}
