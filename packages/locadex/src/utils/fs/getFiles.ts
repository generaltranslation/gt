import { findFilepaths } from './findConfigs.js';

export function getNextDirectories(): string[] {
  return findFilepaths(['./src', './app', './pages']);
}
