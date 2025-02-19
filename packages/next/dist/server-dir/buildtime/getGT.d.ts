import { TranslationOptions } from 'gt-react/internal';
/**
 * getGT() returns a function that translates a string.
 *
 * @returns A promise of the t() function used for translating strings
 *
 * @example
 * const t = await getGT();
 * console.log(t('Hello, world!')); // Translates 'Hello, world!'
 */
export default function getGT(): Promise<(content: string, options?: {
    locale?: string;
} & TranslationOptions) => string>;
//# sourceMappingURL=getGT.d.ts.map