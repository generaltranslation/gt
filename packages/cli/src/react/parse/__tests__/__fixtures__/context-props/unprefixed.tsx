import { T } from 'gt-react';

export function Page() {
  return (
    <div>
      <T context='A publication or something you read from' id='book-plain'>
        <p>Book</p>
      </T>
      <T maxChars={12}>
        <p>Ledger</p>
      </T>
    </div>
  );
}
