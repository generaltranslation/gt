import { Derive, Select } from 'gt-react';

export default function DeriveWrappingBranch() {
  return (
    <div>
      Hello <Derive><Select value="x">fallback</Select></Derive>
    </div>
  );
}
