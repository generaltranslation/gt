import * as path from 'node:path';

type PathApi = Pick<
  typeof path,
  'basename' | 'isAbsolute' | 'relative' | 'sep'
>;

export function relativeToCwd(
  cwd: string,
  file: string,
  pathApi: PathApi = path
): string {
  const relativePath = pathApi.relative(cwd, file);
  if (
    !relativePath ||
    relativePath === '..' ||
    relativePath.startsWith(`..${pathApi.sep}`) ||
    pathApi.isAbsolute(relativePath)
  ) {
    return pathApi.basename(file);
  }
  return relativePath;
}

export function normalizePath(pathname: string): string {
  return pathname.replaceAll('\\', '/');
}
