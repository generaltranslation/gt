import { nativeLanguage } from './native-language.js';

/** `.mdx` files: ESM, JSX and `{…}` expressions as one JSX module, the way MDX compiles them. */
export const mdxLanguage = nativeLanguage({
  name: 'mdx',
  extensions: ['.mdx'],
});
