import { Plural } from 'gt-react';

export default function PluralWithJsxForms() {
  const count = 3;
  return (
    <div>
      <Plural n={count} one={<b>one item</b>} other={<b>many items</b>} />
    </div>
  );
}
