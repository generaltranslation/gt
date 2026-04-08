import { Branch } from 'gt-react';

export default function BranchBasic() {
  return (
    <div>
      <Branch branch="status" active={<span>Active</span>}>
        Fallback
      </Branch>
    </div>
  );
}
