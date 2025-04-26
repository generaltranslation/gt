import fs from 'node:fs';
import path from 'node:path';

// Define the file extensions to look for
const extensions = ['.js', '.jsx', '.tsx'];

/**
 * Recursively scan the directory and collect all files with the specified extensions,
 * excluding files or directories that start with a dot (.)
 * @param dir - The directory to scan
 * @returns An array of file paths
 */
export function getFiles(dir: string): string[] {
  let files: string[] = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    // Skip hidden files and directories
    if (item.startsWith('.')) continue;

    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Recursively scan subdirectories
      files = files.concat(getFiles(fullPath));
    } else if (extensions.includes(path.extname(item))) {
      // Add files with the specified extensions
      files.push(fullPath);
    }
  }

  return files;
}
