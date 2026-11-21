import { Select } from 'gt-react';

export default function BranchInBraces() {
  const name = 'Ada';
  const mode = 'quick';
  return <div>{name}{<Select value={mode} quick="Quick mode">Standard mode</Select>}</div>;
}
