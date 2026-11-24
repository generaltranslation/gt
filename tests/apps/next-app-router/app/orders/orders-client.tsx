'use client';

import { T } from 'gt-next';

export function OrdersClient() {
  return (
    <section className='panel'>
      <p className='label'>Client component of the orders page</p>
      <T>
        <p>This paragraph is translated in a client component of one page.</p>
      </T>
    </section>
  );
}
