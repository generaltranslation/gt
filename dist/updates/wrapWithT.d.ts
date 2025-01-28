import { Updates, WrapOptions } from '../main';
/**
 * Wraps all JSX elements in the src directory with a <T> tag, with unique ids.
 * - Ignores pure strings
 *
 * @param options - The options object
 * @returns An object containing the updates and errors
 */
export default function wrapWithT(options: WrapOptions): Promise<{
    updates: Updates;
    errors: string[];
}>;
