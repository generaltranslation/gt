/**
 * Runtime translation component that renders its children in the user's given locale.
 * Can only be used in server components.
 *
 * @example
 * ```jsx
 * // Basic usage:
 * <Tx id="welcome_message">
 *  Hello, <Var>{name}</Var>!
 * </Tx>
 * ```
 *
 * @example
 * ```jsx
 * // Translating a plural
 * <T id="item_count">
 *  <Plural n={3} singular={<>You have <Num children={n}/> item.</>}>
 *      You have <Num children={n}/> items.
 *  </Plural>
 * </T>
 * ```
 *
 * @param {React.ReactNode} children - The content to be translated or displayed.
 * @param {string} [id] - Optional identifier for the translation string. If not provided, a hash will be generated from the content.
 * @param {any} [context] - Additional context for translation key generation.
 *
 * @returns {JSX.Element} The rendered translation or fallback content based on the provided configuration.
 *
 * @throws {Error} If a plural translation is requested but the `n` option is not provided.
 */
declare function Tx({ children, id, context, locale, }: {
    children: any;
    id?: string;
    context?: string;
    locale?: string;
}): Promise<any>;
declare namespace Tx {
    var gtTransformation: string;
}
export default Tx;
//# sourceMappingURL=_Tx.d.ts.map