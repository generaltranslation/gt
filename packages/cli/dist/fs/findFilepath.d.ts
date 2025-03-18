/**
 * Resolve the file path from the given file path or default paths.
 * @param {string} filePath - The file path to resolve.
 * @param {string[]} defaultPaths - The default paths to check.
 * @returns {string} - The resolved file path.
 */
export default function findFilepath(paths: string[], errorMessage?: string): string;
/**
 * Resolve the file paths from the given file paths or default paths.
 * @param {string[]} paths - The file paths to resolve.
 * @param {string} errorMessage - The error message to throw if no paths are found.
 * @returns {string[]} - The resolved file paths.
 */
export declare function findFilepaths(paths: string[], errorMessage?: string): string[];
export declare function getRelativePath(file: string, srcDirectory: string): string;
/**
 * Find a file in a directory based on a wildcard pattern.
 * @param {string} filePattern - The wildcard pattern to search for.
 * @param {string} file - The file to search for.
 * @returns {string} - The path to the file.
 */
export declare function findFile(filePattern: string, file: string): string;
/**
 * Read a file and return the contents.
 * @param {string} filePath - The path to the file to read.
 * @returns {string} - The contents of the file.
 */
export declare function readFile(filePath: string): string;
/**
 * Find a file in a directory.
 * @param {string} dir - The directory to search in.
 * @param {string} file - The file to search for.
 * @returns {string} - The path to the file.
 */
export declare function findFileInDir(dir: string, file: string): string;
