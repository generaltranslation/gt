import { t } from 'gt-react';

// Module-level t(): this call runs once, when this module is first evaluated.
// In this SPA that happens in the browser, inside a route that loads after
// initializeGTSPA() has completed (see entry.client.tsx), so t() resolves
// against loaded translations. Because gt-react reloads the page when the
// locale changes, this module is re-evaluated on the next load and the value
// re-resolves for the newly selected locale.
export const moduleLevelHeading = t(
  'This sentence is produced by a t() call at the top level of a module.'
);
