import { Branch } from 'gt-react';

export default function BranchWithFragmentProp() {
  return (
    <div>
      <Branch branch={'x' as string} a={<>Fragment content</>} other="Default" />
    </div>
  );
}
