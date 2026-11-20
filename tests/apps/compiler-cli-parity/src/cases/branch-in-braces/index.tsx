import { Branch } from 'gt-react';

export default function BranchInBraces() {
  const name = 'Ada';
  const mode = 'quick';
  return <div>{name}{<Branch branch={mode} quick="Quick mode">Standard mode</Branch>}</div>;
}
