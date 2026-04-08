import { Branch } from 'gt-react';

export default function BranchWithPluralFormProps() {
  return (
    <div>
      <Branch branch="count" one="One item" few="A few items" many="Many items">
        Default items
      </Branch>
    </div>
  );
}
