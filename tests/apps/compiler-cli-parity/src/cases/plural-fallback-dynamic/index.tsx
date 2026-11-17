import { Plural } from 'gt-react';

export default function PluralFallbackDynamic() {
  const count = 5;
  return (
    <div>
      <Plural n={count} other={<>
        You have {count} items
      </>} />
    </div>
  );
}
