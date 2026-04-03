import { T, Branch } from 'gt-react';

export default function UserTWithBranchSibling() {
  return (
    <div>
      <T>Manual text</T>
      <div>
        <Branch branch="x" a="Option A">Default</Branch>
      </div>
    </div>
  );
}
