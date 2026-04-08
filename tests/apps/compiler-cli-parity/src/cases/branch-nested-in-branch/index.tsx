import { Branch } from 'gt-react';

export default function BranchNestedInBranch() {
  return (
    <div>
      <Branch
        branch="outer"
        a={
          <Branch branch="inner" x="Inner X" y="Inner Y">
            Inner default
          </Branch>
        }
      >
        Outer default
      </Branch>
    </div>
  );
}
