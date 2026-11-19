import { Branch } from 'gt-react';

export default function BranchBasic() {
  return (
    <div>
      <Branch branch={'status' as string} active={<span>Active</span>}>Fallback</Branch>
    </div>
  );
}
