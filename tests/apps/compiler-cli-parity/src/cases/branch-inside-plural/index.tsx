import { Branch, Plural } from 'gt-react';

export default function BranchInsidePlural() {
  const count = 3;
  return (
    <div>
      <Plural n={count}>
        <Branch branch="x">fallback</Branch>
      </Plural>
    </div>
  );
}
