import { msg } from 'gt-next';

// Plain module-level msg() calls. In production builds the compiler embeds
// the fr translations from translations/fr.json at these call sites.
export const compiledGreeting = msg('Compiled greeting');

export const compiledSteps = msg([
  'Compiled first step',
  'Compiled second step',
]);
