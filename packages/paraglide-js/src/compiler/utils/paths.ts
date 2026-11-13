import path from 'node:path';

const SCRIPT = /\.[cm]?[jt]sx?$/;
const DECLARATION = /\.d\.[cm]?ts$/;

export function toPosix(file: string): string {
  return file.split(path.sep).join('/');
}

/** `file` relative to `directory` with forward slashes, if inside it. */
export function relativeWithin(
  directory: string,
  file: string
): string | undefined {
  const relative = path.relative(directory, file);
  return relative === '' ||
    relative.startsWith('..') ||
    path.isAbsolute(relative)
    ? undefined
    : toPosix(relative);
}

/** `file` relative to `root` with forward slashes; "." for `root` itself. */
export function relativePath(root: string, file: string): string {
  return toPosix(path.relative(root, file)) || '.';
}

export function isWithin(directory: string, file: string): boolean {
  return relativeWithin(directory, file) !== undefined;
}

export function isScript(file: string): boolean {
  return SCRIPT.test(file) && !DECLARATION.test(file);
}

export function isDependency(file: string): boolean {
  return toPosix(file).includes('/node_modules/');
}
