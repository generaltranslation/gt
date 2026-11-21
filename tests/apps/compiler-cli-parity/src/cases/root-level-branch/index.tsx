import { Select } from 'gt-react';

export default function RootLevelBranch() {
  return (
    <Select value={'x' as string} a={<span>Option A</span>}>Default</Select>
  );
}
