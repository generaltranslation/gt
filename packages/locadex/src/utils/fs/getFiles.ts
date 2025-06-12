import { findFilepaths } from './findConfigs.js';

export function getNextDirectories(cwd: string): string[] {
  return findFilepaths(['./src', './app', './pages'], cwd);
}
