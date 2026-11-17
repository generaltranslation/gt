import { Branch } from 'gt-react';

export default function FragmentWithBranch() {
  return (
    <>
      Label: <Branch branch={'x' as string} a="Option A" other="Default" />
    </>
  );
}
