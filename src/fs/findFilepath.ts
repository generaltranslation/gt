import fs from "fs";

/**
 * Resolve the file path from the given file path or default paths.
 * @param {string} filePath - The file path to resolve.
 * @param {string[]} defaultPaths - The default paths to check.
 * @returns {string} - The resolved file path.
 */
export default function findFilepath(
  paths: string[],
  errorMessage: string = ""
): string {
  for (const possiblePath of paths) {
    if (fs.existsSync(possiblePath)) {
      return possiblePath;
    }
  }
  if (errorMessage) {
    throw new Error(errorMessage);
  }
  return "";
}
