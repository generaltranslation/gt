import path from 'node:path';

export function fromPackageRoot(relative: string) {
  return path.resolve(__dirname, `../../`, relative);
}
