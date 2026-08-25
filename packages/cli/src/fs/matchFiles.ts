import fg from 'fast-glob';
import { toPosixGlob } from '../utils/paths.js';

export function matchFiles(cwd: string, patterns: string[]): string[] {
  return fg.sync(patterns.map(toPosixGlob), {
    cwd,
    absolute: true,
    onlyFiles: true,
  });
}
