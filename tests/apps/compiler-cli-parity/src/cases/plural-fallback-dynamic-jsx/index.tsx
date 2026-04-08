import { Plural } from 'gt-react';

export default function PluralFallbackDynamicJsx() {
  const n = 5;
  return (
    <div>
      <Plural n={n}>
        <span>You have {n} items</span>
      </Plural>
    </div>
  );
}
