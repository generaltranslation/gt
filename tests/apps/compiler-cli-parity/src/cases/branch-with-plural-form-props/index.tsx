import { Select } from 'gt-react';

export default function BranchWithPluralFormProps() {
  return (
    <div>
      <Select value={'count' as string} one="One item" few="A few items" many="Many items">Default items</Select>
    </div>
  );
}
