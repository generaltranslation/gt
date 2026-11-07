'use client';

import { useGT, useMessages } from 'gt-next';
import { greeting, steps } from './messages';

export function MessagesPanel() {
  const gt = useGT();
  const m = useMessages();

  return (
    <section>
      {/* Embedded by the compiler from translations/fr.json */}
      <p data-testid='embedded'>{gt('Embedded string')}</p>
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
