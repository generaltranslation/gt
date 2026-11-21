import { Select } from 'gt-react';

export default function BranchWithFragmentProp() {
  return (
    <div>
      <Select value={'x' as string} a={<>Fragment content</>}>Default</Select>
    </div>
  );
}
