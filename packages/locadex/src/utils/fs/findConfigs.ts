import path from 'node:path';
import fs from 'node:fs';

export function findTsConfig(cwd: string): string | undefined {
  const possiblePaths = [
    path.join(cwd, 'tsconfig.json'),
    path.join(cwd, 'tsconfig.app.json'),
    path.join(cwd, 'jsconfig.json'),
  ];

  for (const configPath of possiblePaths) {
    if (fs.existsSync(configPath)) {
      return configPath;
    }
  }

  return undefined;
}

export function findWebpackConfig(cwd: string): string | undefined {
  const possiblePaths = [
    path.join(cwd, 'webpack.config.js'),
    path.join(cwd, 'webpack.config.ts'),
    path.join(cwd, 'next.config.js'),
    path.join(cwd, 'next.config.ts'),
  ];

  for (const configPath of possiblePaths) {
    if (fs.existsSync(configPath)) {
      return configPath;
    }
  }

  return undefined;
}
/**
 * Resolve the file paths from the given file paths or default paths.
 * @param {string[]} paths - The file paths to resolve.
 * @param {string} errorMessage - The error message to throw if no paths are found.
 * @returns {string[]} - The resolved file paths.
 */
export function findRequireConfig(cwd: string): string | undefined {
  const possiblePaths = [
    path.join(cwd, 'require.config.js'),
    path.join(cwd, 'requirejs.config.js'),
  ];

  for (const configPath of possiblePaths) {
    if (fs.existsSync(configPath)) {
      return configPath;
    }
  }

  return undefined;
}

export function findFilepaths(paths: string[], cwd: string): string[] {
  const resolvedPaths: string[] = [];
  for (const possiblePath of paths) {
    if (fs.existsSync(path.resolve(cwd, possiblePath))) {
      resolvedPaths.push(path.resolve(cwd, possiblePath));
    }
  }
  return resolvedPaths;
}
