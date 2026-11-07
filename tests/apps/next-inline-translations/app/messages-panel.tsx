'use client';

import { useMessages } from 'gt-next';
import { compiledGreeting, compiledSteps } from './compiled-messages';
import { greeting, steps } from './messages';

export function MessagesPanel() {
  const m = useMessages();

  return (
    <section>
      <p data-testid='greeting'>{m(greeting)}</p>
      <ol>
        {steps.map((step) => (
          <li key={step} data-testid='step'>
            {m(step)}
          </li>
        ))}
      </ol>
      <p data-testid='compiled-greeting'>{m(compiledGreeting)}</p>
      <ol>
        {compiledSteps.map((step) => (
          <li key={step} data-testid='compiled-step'>
            {m(step)}
          </li>
        ))}
      </ol>
    </section>
  );
}
