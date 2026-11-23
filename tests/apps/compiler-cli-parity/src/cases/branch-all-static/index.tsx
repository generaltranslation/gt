import { Select } from 'gt-react';

export default function BranchAllStatic() {
  return (
    <div>
      <Select value={'color' as string} red="Red" blue="Blue">Default</Select>
    </div>
  );
}
