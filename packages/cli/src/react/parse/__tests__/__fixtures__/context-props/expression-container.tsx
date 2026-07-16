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
      <T $requiresReview>
        <p>Manifest</p>
      </T>
      <T $requiresReview={true}>
        <p>Charter</p>
      </T>
    </div>
  );
}
