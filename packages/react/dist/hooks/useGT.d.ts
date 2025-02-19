import { TranslationOptions } from '../types/types';
/**
 * Gets the translation function `t` provided by `<GTProvider>`.
 *
 * @returns {Function} A translation function that accepts a key string and returns the translated value.
 *
 * @example
 * const t = useGT();
 * console.log(t('To be or not to be...'));
 *
 * const t = useGT();
 * return (<> {t('...that is the question')} </>);
 */
export default function useGT(): (content?: string, options?: TranslationOptions) => string;
//# sourceMappingURL=useGT.d.ts.map