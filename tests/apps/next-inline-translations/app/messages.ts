import { msg } from 'gt-next';

// Module-level msg() calls with inline translations, the shape the compiler
// injects for embedded locales. They register when this module is evaluated,
// which can happen in a different server bundle layer than the one that
// renders them.
export const greeting = msg('Inline greeting', undefined, (locale) =>
  locale === 'fr' ? 'Salutation intégrée' : undefined
);

export const steps = msg(['First step', 'Second step'], undefined, (locale) =>
  locale === 'fr' ? ['Première étape', 'Deuxième étape'] : undefined
);
