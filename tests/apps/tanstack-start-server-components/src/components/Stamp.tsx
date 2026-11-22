'use client';

import { T } from 'gt-tanstack-start';

/** A client component that only the payload of the composite component names. */
export function Stamp() {
  return (
    <p data-component='stamp' data-m data-src='Stamped in the browser'>
      <T>Stamped in the browser</T>
    </p>
  );
}
