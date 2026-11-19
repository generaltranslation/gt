import type { ReactNode } from 'react';
import { t } from 'gt-react';

// The entry imports this module statically, so its message is in the entry's
// translations file. The application root reads the same message as its
// module is evaluated, and its own file leaves it out.
export function Frame({ children }: { children: ReactNode }) {
  return (
    <>
      <p data-test='frame'>{t`Acme workspace`}</p>
      {children}
    </>
  );
}
