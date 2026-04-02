import { Plural } from 'gt-react';

export default function PluralBasic() {
  const count = 3;
  return (
    <div>
      <Plural n={count} one="item" other="items" />
    </div>
  );
}
