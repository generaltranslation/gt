import { Select } from 'gt-react';

export default function BranchDynamicPropValue() {
  const count = 42;
  return (
    <div>
      <Select value="hello" hello={count} />
    </div>
  );
}
