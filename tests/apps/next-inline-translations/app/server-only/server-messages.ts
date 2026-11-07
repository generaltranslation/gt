import { msg } from 'gt-next';

export const serverGreeting = msg('Server greeting', undefined, (locale) =>
  locale === 'fr' ? 'Salutation serveur' : undefined
);
