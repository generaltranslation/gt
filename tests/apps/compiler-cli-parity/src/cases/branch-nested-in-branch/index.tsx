import { Select } from 'gt-react';

export default function BranchNestedInBranch() {
  return (
    <div>
      <Select
        value={'outer' as string}
        a={
          <Select value={'inner' as string} x="Inner X" y="Inner Y">Inner default</Select>
        }
      >Outer default</Select>
    </div>
  );
}
