import { Plural } from 'gt-react';

export default function PluralFallbackDynamic() {
  const count = 5;
  return (
    <div>
      <Plural n={count}>
        You have {count} items
      </Plural>
    </div>
  );
}
