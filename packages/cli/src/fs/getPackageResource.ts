import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function fromPackageRoot(relative: string) {
  console.log('fromPackageRoot __dirname' + __dirname);
  return path.resolve(__dirname, `../../`, relative);
}

export function fromBinariesRoot(relative: string) {
  console.log('fromBinariesRoot __dirname' + __dirname);
  return path.resolve(__dirname, `../`, relative);
}
