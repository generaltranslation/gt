import * as path from 'node:path';

type PathApi = Pick<typeof path, 'isAbsolute' | 'relative'>;

export function relativeToCwd(
  cwd: string,
  file: string,
  pathApi: PathApi = path
): string {
  const relativePath = pathApi.relative(cwd, file);
  if (!relativePath) return file;
  return pathApi.isAbsolute(relativePath) ? file : relativePath;
}

export function normalizePath(pathname: string): string {
  return pathname.replaceAll('\\', '/');
}

export function isNodeModulesPath(pathname: string): boolean {
  return normalizePath(pathname).split('/').includes('node_modules');
}
