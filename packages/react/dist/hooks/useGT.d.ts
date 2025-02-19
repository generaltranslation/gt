/**
 * Gets the translation function `t` provided by `<GTProvider>`.
 *
 * @returns {Function} A translation function that accepts a key string and returns the translated value.
 *
 * @example
 * const t = useGT('user');
 * console.log(t('To be or not to be...'));
 *
 * const t = useGT();
 * return (<> {t('...that is the question')} </>);
 */
export default function useGT(): (content?: string, id?: string, options?: Record<string, any>, metadata?: Record<string, any>) => string;
//# sourceMappingURL=useGT.d.ts.map