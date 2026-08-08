import fg from 'fast-glob';
import { toPosixPath } from '../utils/paths.js';

export function matchFiles(cwd: string, patterns: string[]): string[] {
  return fg.sync(patterns.map(toPosixPath), {
    cwd,
    absolute: true,
    onlyFiles: true,
  });
}
