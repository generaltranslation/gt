import { T, Select } from 'gt-react';

export default function UserTWithBranchSibling() {
  return (
    <div>
      <T>Manual text</T>
      <div>
        <Select value={'x' as string} a="Option A">Default</Select>
      </div>
    </div>
  );
}
