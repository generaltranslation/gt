import { Branch } from 'gt-react';

export default function BranchNoChildren() {
  return (
    <div>
      <Branch branch={'mode' as string} a="Option A" b="Option B" other="Another option" />
    </div>
  );
}
