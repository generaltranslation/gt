import { Select, Plural } from 'gt-react';

export default function BranchInsidePlural() {
  const count = 3;
  return (
    <div>
      <Plural n={count}>
        <Select value="x">fallback</Select>
      </Plural>
    </div>
  );
}
