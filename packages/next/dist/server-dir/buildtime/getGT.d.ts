import { InlineTranslationOptions } from 'gt-react/internal';
/**
 * getGT() returns a function that translates a string, being marked as translated at build time.
 *
 * @returns A promise of the t() function used for translating strings
 *
 * @example
 * const t = await getGT();
 * console.log(t('Hello, world!')); // Translates 'Hello, world!'
 */
export default function getGT(): Promise<(string: string, options?: InlineTranslationOptions) => string>;
//# sourceMappingURL=getGT.d.ts.map