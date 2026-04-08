import { InlineTranslationOptions } from 'gt-i18n/types';

/**
 * Overloaded type for the `t` function.
 * - Tagged template: t`Hello, ${name}` (transformed by the compiler plugin at build time)
 * - Function call: t("Hello, {name}", { name: "John" })
 *
 * {@link TemplateSyncResolutionFunction}
 * {@link SyncResolutionFunction}
 */
export interface StringOrTemplateSyncResolutionFunction {
  (strings: TemplateStringsArray, ...values: unknown[]): string;
  (message: string, options?: InlineTranslationOptions): string;
}

/**
 * Type for the `t` function when used as a tagged template literal.
 * @param strings - The template strings.
 * @param values - The values to interpolate.
 * @returns The translated message.
 */
export type TemplateSyncResolutionFunction = (
  strings: TemplateStringsArray,
  ...values: unknown[]
) => string;
