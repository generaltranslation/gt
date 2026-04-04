import { Plural } from 'gt-react';

export default function PluralAllForms() {
  const count = 3;
  return (
    <div>
      <Plural
        n={count}
        zero="zero items"
        one="one item"
        two="two items"
        few="a few items"
        many="many items"
        other="other items"
      />
    </div>
  );
}
