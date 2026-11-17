import { Branch } from 'gt-react';

export default function BranchFallbackDynamic() {
  const name = 'Alice';
  return (
    <div>
      <Branch branch={name} other={<>
        Fallback with {name}
      </>} />
    </div>
  );
}
