/**
 * Translation component that renders its children translated into the user's given locale.
 *
 * @example
 * ```jsx
 * // Basic usage:
 * <TX id="welcome_message">
 *  Hello, <Var name="name" value={firstname}>!
 * </TX>
 * ```
 *
 * @example
 * ```jsx
 * // Translating a plural
 * <TX id="item_count">
 *  <Plural n={3} singular={<>You have <Num value={n}/> item.</>}>
 *      You have <Num value={n}/> items.
 *  </Plural>
 * </TX>
 * ```
 *
 * When used on the server-side, can create translations on demand.
 * If you need to ensure server-side usage import from `'gt-next/server'`.
 *
 * When used on the client-side, will throw an error if no `id` prop is provided.
 *
 * By default, General Translation saves the translation in a remote cache if an `id` option is passed.
 *
 * @param {React.ReactNode} children - The content to be translated or displayed.
 * @param {string} [id] - Optional identifier for the translation string. If not provided, a hash will be generated from the content.
 * @param {Object} [renderSettings] - Optional settings controlling how fallback content is rendered during translation.
 * @param {"skeleton" | "replace" | "default"} [renderSettings.method] - Specifies the rendering method:
 *  - "skeleton": show a placeholder while translation is loading.
 *  - "replace": show the default content as a fallback while the translation is loading.
 *  - "default": behave like skeleton unless language is same (ie en-GB vs en-US), then behave like replace
 * @param {number | null} [renderSettings.timeout] - Optional timeout for translation loading.
 * @param {any} [context] - Additional context for translation key generation.
 * @param {Object} [props] - Additional props for the component.
 * @returns {JSX.Element} The rendered translation or fallback content based on the provided configuration.
 *
 * @throws {Error} If a plural translation is requested but the `n` option is not provided.
 */
declare function TX({ children, id, context, variables, variablesOptions, }: {
    children: any;
    id?: string;
    context?: string;
    [key: string]: any;
}): Promise<any>;
declare namespace TX {
    var gtTransformation: string;
}
export default TX;
//# sourceMappingURL=TX.d.ts.map