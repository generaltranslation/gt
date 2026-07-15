import { T } from 'gt-react';

export function Page() {
  return (
    <div>
      <T $context={'A braced context'}>
        <p>Shelf</p>
      </T>
      <T $maxChars={12}>
        <p>Ledger</p>
      </T>
    </div>
  );
}
