import { Branch } from 'gt-react';

export default function BranchNestedInBranch() {
  return (
    <div>
      <Branch
        branch={'outer' as string}
        a={
          <Branch branch={'inner' as string} x="Inner X" y="Inner Y" other="Inner default" />
        }
        other="Outer default"
      />
    </div>
  );
}
