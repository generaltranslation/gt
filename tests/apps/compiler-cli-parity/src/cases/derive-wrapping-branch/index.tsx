import { Derive, Branch } from 'gt-react';

export default function DeriveWrappingBranch() {
  return (
    <div>
      Hello <Derive><Branch branch="x">fallback</Branch></Derive>
    </div>
  );
}
