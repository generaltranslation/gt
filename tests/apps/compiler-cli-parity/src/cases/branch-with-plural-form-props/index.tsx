import { Branch } from 'gt-react';

export default function BranchWithPluralFormProps() {
  return (
    <div>
      <Branch branch={'count' as string} one="One item" few="A few items" many="Many items" other="Default items" />
    </div>
  );
}
