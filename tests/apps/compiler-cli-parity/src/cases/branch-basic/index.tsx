import { Select } from 'gt-react';

export default function BranchBasic() {
  return (
    <div>
      <Select value={'status' as string} active={<span>Active</span>}>Fallback</Select>
    </div>
  );
}
