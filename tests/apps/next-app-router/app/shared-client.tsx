'use client';

import { T } from 'gt-next';

export function SharedClient() {
  return (
    <section className='panel'>
      <p className='label'>Client component on every page</p>
      <T>
        <p>
          This paragraph is translated in a client component both pages use.
        </p>
      </T>
    </section>
  );
}
