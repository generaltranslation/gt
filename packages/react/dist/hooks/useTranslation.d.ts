/**
 * Gets the translation function `t` provided by `<GTProvider>`.
 *
 * @returns {Function} A translation function that accepts a key string and returns the translated value.
 *
 * @example
 * const t = useTranslation('user');
 * console.log(await t('To be or not to be...'));
 *
 * const t = useTranslation();
 * return (<> {t('...that is the question')} </>);
 */
export default function useTranslation(): (content?: string, id?: string, options?: Record<string, any>) => Promise<string | undefined>;
//# sourceMappingURL=useTranslation.d.ts.map