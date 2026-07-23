import { StrictMode, startTransition } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { HydratedRouter } from 'react-router/dom';

// Hydrates the prerendered shell into the live React Router app. This module is
// imported dynamically from entry.client.tsx after gt-react has initialized, so
// everything it pulls in runs post-initialization in the browser.
export function hydrate() {
  startTransition(() => {
    hydrateRoot(
      document,
      <StrictMode>
        <HydratedRouter />
      </StrictMode>
    );
  });
}
