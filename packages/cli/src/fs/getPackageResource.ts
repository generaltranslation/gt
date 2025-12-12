import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from '../console/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function fromPackageRoot(relative: string) {
  logger.debug('fromPackageRoot __dirname' + __dirname);
  return path.resolve(__dirname, `../../`, relative);
}

export function fromBinariesRoot(relative: string) {
  logger.debug('fromBinariesRoot __dirname' + __dirname);
  return path.resolve(__dirname, `../`, relative);
}
