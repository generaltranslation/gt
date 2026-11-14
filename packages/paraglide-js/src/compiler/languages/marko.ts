import { nativeLanguage } from './native-language.js';

/** Marko templates, Marko 5 and 6, with tag variables scoped as Marko scopes them. */
export const markoLanguage = nativeLanguage({
  name: 'marko',
  extensions: ['.marko'],
});
