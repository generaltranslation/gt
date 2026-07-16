import { T } from 'gt-react';

export function Page() {
  return (
    <div>
      <T $context='A call-to-action that reserves a hotel stay'>
        <p>Book</p>
      </T>
      <T $context='A noun meaning a printed publication'>
        <p>Book</p>
      </T>
      <T context='an unprefixed context prop'>
        <p>Cover</p>
      </T>
      <T $id='book-id'>
        <p>Spine</p>
      </T>
    </div>
  );
}
