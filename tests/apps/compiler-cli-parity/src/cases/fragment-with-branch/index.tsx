import { Branch } from 'gt-react';

export default function FragmentWithBranch() {
  return (
    <>
      Label: <Branch branch="x" a="Option A">Default</Branch>
    </>
  );
}
