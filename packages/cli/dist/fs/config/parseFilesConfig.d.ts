import { FilesOptions, ResolvedFiles } from '../../types';
/**
 * Resolves the files from the files object
 * Replaces [locale] with the actual locale in the files
 *
 * @param files - The files object
 * @param locale - The locale to replace [locale] with
 * @returns The resolved files
 */
export declare function resolveLocaleFiles(files: ResolvedFiles, locale: string): ResolvedFiles;
/**
 * Resolves the files from the files object
 * Performs glob pattern expansion on the files
 * Replaces [locale] with the actual locale in the files
 *
 * @param files - The files object
 * @returns The resolved files
 */
export declare function resolveFiles(files: FilesOptions, locale: string): {
    resolvedPaths: ResolvedFiles;
    placeholderPaths: ResolvedFiles;
};
