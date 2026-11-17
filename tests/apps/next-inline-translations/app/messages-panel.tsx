'use client';

import { useGT as useStableGT, useMessages } from 'gt-next';
import { useGT } from 'gt-next/unstable';
import { greeting, steps } from './messages';

export function MessagesPanel() {
  const gt = useGT();
  const stableGT = useStableGT();
  const m = useMessages();

  return (
    <section>
      {/* Embedded by the compiler from translations/fr.json */}
      <p data-testid='embedded'>{gt`Embedded string`}</p>
      {/* Stable gt() is never embedded, so it loads from translations/fr.msg.json */}
      <p data-testid='loaded'>{stableGT('Loaded string')}</p>
      <p data-testid='greeting'>{m(greeting)}</p>
      <ol>
        {steps.map((step) => (
          <li key={step} data-testid='step'>
            {m(step)}
          </li>
        ))}
      </ol>
    </section>
  );
}
