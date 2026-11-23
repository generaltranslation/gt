import { Select } from 'gt-react';

export default function FragmentWithBranch() {
  return (
    <>
      Label: <Select value={'x' as string} a="Option A">Default</Select>
    </>
  );
}
