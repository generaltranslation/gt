import { Plural } from 'gt-react';

export default function PluralFallbackDynamicJsx() {
  const n = 5;
  return (
    <div>
      <Plural n={n} other={<span>You own {n} items</span>} />
    </div>
  );
}
