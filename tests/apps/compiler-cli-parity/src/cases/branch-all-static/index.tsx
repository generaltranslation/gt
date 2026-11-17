import { Branch } from 'gt-react';

export default function BranchAllStatic() {
  return (
    <div>
      <Branch branch={'color' as string} red="Red" blue="Blue" other="Default" />
    </div>
  );
}
