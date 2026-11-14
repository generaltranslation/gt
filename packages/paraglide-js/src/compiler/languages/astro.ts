import { nativeLanguage } from './native-language.js';

/**
 * `.astro` components: the frontmatter and template as one TSX module, and each
 * bundled client script as a module of its own.
 */
export const astroLanguage = nativeLanguage({
  name: 'astro',
  extensions: ['.astro'],
});
