'use client';

import { useState } from 'react';
import { T, useGT } from 'gt-tanstack-start';

/**
 * A client component a server component renders. Its messages are in a
 * client chunk that the server's payload names, and no route imports.
 */
export function Counter() {
  const t = useGT();
  const [count, setCount] = useState(0);
  return (
    <div data-component='counter'>
      <p data-m data-src='Pinned by the browser'>{t`Pinned by the browser`}</p>
      <p data-m data-src='Press to count the notices'>
        <T>Press to count the notices</T>
      </p>
      <button data-count onClick={() => setCount(count + 1)}>
        {count}
      </button>
    </div>
  );
}
