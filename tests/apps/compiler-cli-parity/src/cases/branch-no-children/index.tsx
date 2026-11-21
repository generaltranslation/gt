import { Select } from 'gt-react';

export default function BranchNoChildren() {
  return (
    <div>
      <Select value={'mode' as string} a="Option A" b="Option B">Another option</Select>
    </div>
  );
}
